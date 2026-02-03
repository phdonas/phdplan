const API_URL = ""; // Relative path to support localhost and IP access

const app = {
    state: {
        isAuthenticated: false,
        tasks: [],
        strategies: [],
        insights: [],
        view: 'kanban',
        draggedTaskId: null,
        isRegisterMode: false,
        accessToken: null
    },

    init: () => {
        app.checkAuth();
        document.getElementById('login-form').addEventListener('submit', app.handleAuthSubmit);
        document.getElementById('task-form').addEventListener('submit', app.handleTaskSubmit);
        document.getElementById('btn-delete-task').addEventListener('click', app.handleTaskDelete);
        document.getElementById('user-form').addEventListener('submit', app.handleUserSubmit);
        document.getElementById('import-form').addEventListener('submit', app.handleImportSubmit);

        // Auto-fill day of week
        const dateInput = document.getElementById('task-date');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => app.updateDayOfWeek(e.target.value));
        }

        // Show briefing after small delay to ensure DOM is ready
        setTimeout(() => app.checkAndShowBriefing(), 1000);
    },

    checkAuth: () => {
        const token = localStorage.getItem('phd_token');
        if (token) {
            app.state.isAuthenticated = true;
            app.state.accessToken = token;

            // Set default date to today (Local Time)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            const dateInput = document.getElementById('filter-date');
            if (dateInput) {
                dateInput.value = today;
            }

            app.showDashboard();
            app.loadData();
        } else {
            app.showLogin();
        }
    },

    toggleRegisterMode: () => {
        app.state.isRegisterMode = !app.state.isRegisterMode;
        const title = document.querySelector('#login-view h1');
        const subtitle = document.getElementById('login-subtitle');
        const btnSubmit = document.getElementById('btn-login-submit');
        const btnToggle = document.getElementById('btn-toggle-register');

        if (app.state.isRegisterMode) {
            subtitle.innerText = "Crie sua conta para começar";
            btnSubmit.innerText = "Registrar";
            btnToggle.innerText = "Já tem conta? Entrar";
        } else {
            subtitle.innerText = "Entre para gerenciar seu crescimento";
            btnSubmit.innerText = "Entrar";
            btnToggle.innerText = "Não tem conta? Crie agora";
        }
    },

    handleAuthSubmit: async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (app.state.isRegisterMode) {
            // Register
            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (res.ok) {
                    const data = await res.json();
                    app.setSession(data.access_token);
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erro ao registrar");
                }
            } catch (error) {
                console.error(error);
                alert("Erro de conexão");
            }
        } else {
            // Login
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            try {
                const res = await fetch(`${API_URL}/auth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    app.setSession(data.access_token);
                } else {
                    alert("Email ou senha inválidos");
                }
            } catch (error) {
                console.error(error);
                alert("Erro de conexão");
            }
        }
    },

    setSession: (token) => {
        localStorage.setItem('phd_token', token);
        app.state.accessToken = token;
        app.state.isAuthenticated = true;
        app.showDashboard();
        app.loadData();
    },

    logout: () => {
        localStorage.removeItem('phd_token');
        app.state.isAuthenticated = false;
        app.state.accessToken = null;
        location.reload();
    },

    showLogin: () => {
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('dashboard-view').classList.add('hidden');
    },

    showDashboard: () => {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        app.renderTasks();
    },

    setView: (viewName) => {
        app.state.view = viewName;
        ['kanban', 'calendar', 'insights', 'strategy', 'table'].forEach(v => {
            document.getElementById(`${v}-view`).classList.add('hidden');
        });
        document.getElementById(`${viewName}-view`).classList.remove('hidden');

        if (viewName === 'calendar') {
            app.renderCalendar();
        } else if (viewName === 'table') {
            app.renderTable();
        } else if (viewName === 'kanban') {
            app.renderTasks();
        } else if (viewName === 'insights') {
            app.renderInsights();
        } else if (viewName === 'admin') {
            app.renderAdmin();
        }
    },

    loadData: async () => {
        if (!app.state.isAuthenticated) return;

        try {
            const headers = { 'Authorization': `Bearer ${app.state.accessToken}` };
            const [usersRes, strategiesRes, insightsRes] = await Promise.all([
                fetch(`${API_URL}/tasks`, { headers }),
                fetch(`${API_URL}/strategies`, { headers }),
                fetch(`${API_URL}/insights`, { headers })
            ]);

            if (!usersRes.ok || !strategiesRes.ok || !insightsRes.ok) {
                console.error("API Error", usersRes.status, strategiesRes.status, insightsRes.status);
                if (usersRes.status === 401) {
                    app.logout();
                    return;
                }
                throw new Error("Falha na resposta da API");
            }

            app.state.tasks = await usersRes.json();
            app.state.strategies = await strategiesRes.json();
            app.state.insights = await insightsRes.json();

            // Safety check
            if (!Array.isArray(app.state.tasks)) {
                console.error("Tasks response is not an array:", app.state.tasks);
                app.state.tasks = [];
            }

            // Normalize task status if old
            app.state.tasks.forEach(t => {
                if (t.status === 'Pendente') t.status = 'A fazer';
                if (t.status === 'Concluído') t.status = 'Feito';
            });

            console.log("Loaded data:", app.state.tasks.length, "tasks");

            app.populateWeeks();
            app.renderTasks();
            app.renderStrategy();
            app.renderStrategy();
            app.renderInsights();

            // Admin check
            try {
                const meRes = await fetch(`${API_URL}/auth/me`, { headers });
                if (meRes.ok) {
                    const me = await meRes.json();
                    if (me.role === 'admin') {
                        document.getElementById('btn-admin-view').classList.remove('hidden');
                    }
                }
            } catch (e) {
                console.warn("Auth check failed", e);
            }

        } catch (error) {
            console.error("Error loading data:", error);
            alert("Erro ao carregar dados. Verifique a conexão com o servidor.");
        }
    },

    /* --- ADMIN --- */
    renderAdmin: async () => {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Carregando...</td></tr>';

        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
            });
            if (!res.ok) throw new Error("Falha ao carregar usuários");

            const users = await res.json();
            tbody.innerHTML = '';

            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${u.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${u.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select onchange="app.handleUserRoleChange(${u.id}, this.value)" class="border-gray-300 rounded text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="app.handleUserDelete(${u.id})" class="text-red-600 hover:text-red-900">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Erro ao carregar (Apenas Admin)</td></tr>';
        }
    },

    handleUserDelete: async (userId) => {
        if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
            });
            if (res.ok) {
                alert("Usuário excluído.");
                app.renderAdmin();
            } else {
                const err = await res.json();
                alert(err.detail || "Erro ao excluir.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    },

    handleUserRoleChange: async (userId, newRole) => {
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                // Success feedback?
                // alert("H: " + newRole);
            } else {
                alert("Erro ao alterar permissão.");
                app.renderAdmin(); // Revert ui
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    },

    openUserModal: () => {
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('user-modal').classList.remove('hidden');
    },

    handleUserSubmit: async (e) => {
        e.preventDefault();
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-password').value;

        try {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify({ email, password })
            });

            if (res.ok) {
                alert("Usuário criado com sucesso!");
                document.getElementById('user-modal').classList.add('hidden');
                app.renderAdmin();
            } else {
                const err = await res.json();
                alert(err.detail || "Erro ao criar usuário.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro de conexão.");
        }
    },

    exportData: () => {
        window.location.href = `${API_URL}/export`;
    },

    toggleModal: (show) => {
        const modal = document.getElementById('checklist-modal');
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    },

    /* --- FILTERS --- */
    populateWeeks: () => {
        const setupFilter = (typePrefix) => {
            const weekTypeSelect = document.getElementById(`filter-week-type${typePrefix}`);
            const weekNumInput = document.getElementById(`filter-week-num${typePrefix}`);
            const dateInput = document.getElementById(`filter-date${typePrefix}`);

            if (!weekTypeSelect) return;

            weekTypeSelect.addEventListener('change', () => {
                if (weekTypeSelect.value === 'number') {
                    weekNumInput.classList.remove('hidden');
                } else {
                    weekNumInput.classList.add('hidden');
                }
                if (weekTypeSelect.value !== 'all') dateInput.value = '';

                // Rerender current view
                if (app.state.view === 'table') app.renderTable();
                else app.renderTasks();
            });

            weekNumInput.addEventListener('input', () => {
                if (app.state.view === 'table') app.renderTable();
                else app.renderTasks();
            });

            dateInput.addEventListener('change', () => {
                if (dateInput.value) {
                    weekTypeSelect.value = 'all';
                    weekNumInput.classList.add('hidden');
                }
                if (app.state.view === 'table') app.renderTable();
                else app.renderTasks();
            });
        };

        setupFilter('');       // Kanban
        setupFilter('-table'); // Table
    },

    getFilteredTasks: () => {
        let tasks = [...app.state.tasks];
        let suffix = app.state.view === 'table' ? '-table' : '';

        // If we are in table view but the user hasn't touched the table filters yet, 
        // maybe we shouldn't default to filtering nothing? 
        // Logic: Checks input values.

        const dateInput = document.getElementById(`filter-date${suffix}`);
        const weekType = document.getElementById(`filter-week-type${suffix}`);
        const weekNumInput = document.getElementById(`filter-week-num${suffix}`);

        if (dateInput && dateInput.value) {
            tasks = tasks.filter(t => t.data === dateInput.value);
        }

        if (weekType && weekType.value !== 'all') {
            const currentWeek = app.getWeekNumber(new Date());

            if (weekType.value === 'current') {
                tasks = tasks.filter(t => t.data && app.getWeekNumber(new Date(t.data)) === currentWeek);
            } else if (weekType.value === 'previous') {
                tasks = tasks.filter(t => t.data && app.getWeekNumber(new Date(t.data)) === currentWeek - 1);
            } else if (weekType.value === 'next') {
                tasks = tasks.filter(t => t.data && app.getWeekNumber(new Date(t.data)) === currentWeek + 1);
            } else if (weekType.value === 'number') {
                const num = parseInt(weekNumInput.value);
                if (num) {
                    tasks = tasks.filter(t => t.data && app.getWeekNumber(new Date(t.data)) === num);
                }
            }
        }
        return tasks;
    },

    /* --- KANBAN & DND --- */
    renderTasks: () => {
        const cols = {
            'A fazer': document.getElementById('col-afazer'),
            'Fazendo': document.getElementById('col-fazendo'),
            'Feito': document.getElementById('col-feito')
        };
        const counts = {
            'A fazer': document.getElementById('count-afazer'),
            'Fazendo': document.getElementById('count-fazendo'),
            'Feito': document.getElementById('count-feito')
        };

        // Clear cols
        Object.values(cols).forEach(c => c.innerHTML = '');

        let tasks = app.getFilteredTasks();

        // Count initialization
        let countVals = { 'A fazer': 0, 'Fazendo': 0, 'Feito': 0 };

        // Add "New Task" button to "A fazer"
        const addBtn = document.createElement('button');
        addBtn.className = "w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-indigo-500 hover:text-indigo-500 transition-colors mb-2 font-medium text-sm";
        addBtn.innerHTML = "+ Nova Tarefa";
        addBtn.onclick = () => app.openTaskModal(null, 'task');
        cols['A fazer'].appendChild(addBtn);

        tasks.forEach(task => {
            // Mapping check
            let status = task.status;
            // Robust normalization
            if (status === 'Pendente') status = 'A fazer';
            if (status === 'Concluído') status = 'Feito';

            // If status is not one of the columns (e.g. still 'Pendente' due to logic fail, or random string)
            // default to 'A fazer'
            if (!cols[status]) {
                status = 'A fazer';
            }

            // Ensure not counting twice if fallback happened
            // (Actually logic above ensures 'status' is a valid key)

            countVals[status]++;

            const card = document.createElement('div');
            card.draggable = true;
            card.ondragstart = (e) => app.drag(e, task.id);

            card.className = "bg-white p-3 rounded shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer select-none";

            // Color by priority
            const borderClass = task.prioridade === 'Alta' ? 'border-red-500' : (task.prioridade === 'Média' ? 'border-yellow-500' : 'border-blue-500');
            card.classList.add(borderClass);

            let dateDisplay = '';
            if (task.data) {
                const [y, m, d] = task.data.split('-');
                dateDisplay = `${d}/${m}/${y}`;
            }

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-medium text-gray-900">${task.descricao}</h4>
                    <span class="text-xs text-gray-400">${dateDisplay}</span>
                </div>
                <div class="mt-2 flex items-center justify-between">
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${task.categoria}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                app.openTaskModal(task, 'task');
            });

            cols[status].appendChild(card);
        });

        // Update counts
        Object.keys(counts).forEach(k => counts[k].innerText = countVals[k]);
    },

    allowDrop: (ev) => {
        ev.preventDefault();
    },

    drag: (ev, taskId) => {
        app.state.draggedTaskId = taskId;
        ev.dataTransfer.setData("text", taskId);
    },

    drop: async (ev, newStatus) => {
        ev.preventDefault();
        const taskId = app.state.draggedTaskId;
        if (!taskId) return;

        // Find task
        const task = app.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        if (task.status === newStatus) return; // No change

        // Optimistic UI Update
        task.status = newStatus;
        app.renderTasks();

        // Update Backend
        try {
            // Only send status to avoid issues with other fields
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                const errText = await res.text();
                console.error("Failed to update status", errText);
                alert("Falha ao salvar status no servidor: " + errText);
                app.loadData(); // Revert
            }
        } catch (e) {
            console.error("Drop error", e);
            alert("Erro ao atualizar status.");
            app.loadData(); // Revert
        }
    },


    getWeekNumber: (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    },

    /* --- TABLE --- */
    renderTable: () => {
        const tbody = document.getElementById('tasks-table-body');
        tbody.innerHTML = '';

        let tasks = app.getFilteredTasks();
        tasks.sort((a, b) => new Date(a.data) - new Date(b.data));

        tasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";

            let dateDisplay = '';
            if (task.data) {
                const [y, m, d] = task.data.split('-');
                dateDisplay = `${d}/${m}/${y}`; // Raw formatting
            }

            // Map status for display
            let st = task.status;
            let badgeColor = 'bg-gray-100 text-gray-800';
            if (st === 'Feito' || st === 'Concluído') badgeColor = 'bg-green-100 text-green-800';
            if (st === 'Fazendo') badgeColor = 'bg-blue-100 text-blue-800';
            if (st === 'A fazer' || st === 'Pendente') badgeColor = 'bg-yellow-100 text-yellow-800';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${dateDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.dia_semana || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.tipo_dia || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title="${task.tema_macro || ''}">${task.tema_macro || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title="${task.angulo || ''}">${task.angulo || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.canal_area || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-900 font-medium max-w-xs truncate" title="${task.o_que || task.descricao}">${task.o_que || task.descricao}</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${task.como || ''}">${task.como || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${task.kpi_meta || ''}">${task.kpi_meta || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${task.duracao || ''}">${task.duracao || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${task.cta || ''}">${task.cta || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">
                        ${st}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 mr-2" onclick='app.openTaskModal(${JSON.stringify(task).replace(/'/g, "&#39;")}, "task")'>Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    /* --- INSIGHTS --- */
    renderInsights: () => {
        const list = document.getElementById('insights-list');
        list.innerHTML = '';

        // Sort by ID is done in backend or here? 
        // Backend now sorts by ID desc.

        app.state.insights.forEach(insight => {
            if (insight.status === 'Convertido') return;

            const card = document.createElement('div');
            card.className = "glass p-4 rounded-lg relative hover:shadow-lg transition-all cursor-pointer";

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">${insight.categoria}</span>
                    <span class="text-xs text-gray-500">${insight.data_prevista || 'Sem data'}</span>
                </div>
                <p class="mt-2 text-gray-800 font-medium">${insight.descricao}</p>
            `;

            card.onclick = () => app.openTaskModal(insight, 'insight');

            list.appendChild(card);
        });
    },

    /* --- MODAL (Unified for Task & Insight) --- */
    openTaskModal: (item = null, mode = 'task') => {
        app.state.modalMode = mode;
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        const form = document.getElementById('task-form');
        const deleteBtn = document.getElementById('btn-delete-task');

        modal.classList.remove('hidden');
        form.reset();

        // Setup defaults
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('task-date').value = today;
        app.updateDayOfWeek(today); // Trigger auto-fill default
        document.getElementById('task-priority').value = 'Baixa'; // Default requested
        document.getElementById('task-status').value = 'A fazer'; // Default requested

        // Transform Button Logic
        let transformBtn = document.getElementById('btn-transform-task');
        if (!transformBtn) {
            // Create if missing (we didn't add to HTML yet, so let's inject it dynamically or assume I should have added it?)
            // I'll inject it into the footer if missing.
            const footer = form.querySelector('.flex.justify-end'); // Wait, the footer structure changed.
            // Let's assume I need to handle this button visibility.
            // I'll insert it into the DOM if not present.
            // Note: HTML footer has: Delete (left), Cancel (right), Save (right).

            // Let's add it to the LEFT next to Delete.
        }

        // Clean up any dynamically added transform buttons from previous opens
        const oldBtn = document.getElementById('btn-transform-task');
        if (oldBtn) oldBtn.remove();

        if (mode === 'insight') {
            title.innerText = item ? 'Editar Insight' : 'Novo Insight';
            document.getElementById('task-status').parentElement.parentElement.classList.add('hidden'); // Hide status/priority row? 
            // User said "mesma UI da inclusão de atividades". 
            // Insights usually don't have "Fazendo/Feito" status in the same way, but requested defaults: 
            // "data é a data do dia; status A fazer; Prioridade Baixa".
            // So show them.
            // But if it's an insight, maybe we don't need all fields? 
            // "mesma UI": implies all fields available.

            document.getElementById('task-status').parentElement.parentElement.classList.remove('hidden');

            if (item) {
                // Populate
                document.getElementById('task-id').value = item.id;
                document.getElementById('task-desc').value = item.descricao;
                document.getElementById('task-category').value = item.categoria;
                document.getElementById('task-date').value = item.data_prevista || today;
                document.getElementById('task-status').value = item.status || 'A fazer';

                // Extended Fields (Now available in Insight item)
                document.getElementById('task-como').value = item.como || '';
                document.getElementById('task-onde').value = item.onde || '';
                document.getElementById('task-cta').value = item.cta || '';
                document.getElementById('task-duracao').value = item.duracao || '';
                document.getElementById('task-kpi').value = item.kpi_meta || '';
                document.getElementById('task-tipo-dia').value = item.tipo_dia || '';
                document.getElementById('task-dia-semana').value = item.dia_semana || '';
                document.getElementById('task-tema-macro').value = item.tema_macro || '';
                document.getElementById('task-angulo').value = item.angulo || '';
                document.getElementById('task-canal').value = item.canal_area || '';
                document.getElementById('task-priority').value = item.prioridade || 'Baixa';

                deleteBtn.classList.remove('hidden');

                // Add "Transformar em Tarefa" button

                // Find the footer container
                // The footer is the parent of the delete button's container? 
                // HTML: <div class="flex justify-between ..."> <button id="btn-delete"> ... </div>
                // Oops, the HTML structure I edited earlier:
                // <div class="flex justify-between items-center bg-gray-50 px-6 py-4 border-t">
                //    <button id="btn-delete-task" class="hidden ..."></button>
                //    <div class="flex space-x-3 ml-auto"> ... </div>
                // </div>

                const footerContainer = deleteBtn.parentElement;

                const transBtn = document.createElement('button');
                transBtn.id = "btn-transform-task";
                transBtn.type = "button";
                transBtn.className = "text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors flex items-center";
                // Remove ml-4 if it's the only thing on the left (if delete is hidden)
                // But if delete is shown, we need margin.

                transBtn.innerHTML = "✨ Transformar em Tarefa";
                transBtn.onclick = () => app.transformInsightToTask(item.id);

                // If delete is hidden, we just append it. If not, we append after.
                // Actually, insertAfter is safe.
                deleteBtn.insertAdjacentElement('afterend', transBtn);

                // Also add margin-left to the button itself if it's following the delete button
                transBtn.classList.add('ml-4');

                // Ensure it is visible even if deleteBtn is hidden?
                // deleteBtn has 'hidden' class. transBtn does not. It should show.
                // BUT if deleteBtn is hidden, it takes 0 space.
                // The flex container 'justify-between' puts the Right Group (Cancel/Save) on right.
                // Left Group is deleteBtn + transBtn.
                // If deleteBtn is hidden, transBtn is the first visible element on left.
                // 'ml-4' might look weird if it's the first element.
                if (deleteBtn.classList.contains('hidden')) {
                    transBtn.classList.remove('ml-4');
                }

            } else {
                document.getElementById('task-id').value = '';
                deleteBtn.classList.add('hidden');
            }
        } else {
            // TASK MODE
            title.innerText = item ? 'Editar Tarefa' : 'Nova Tarefa';
            document.getElementById('task-status').parentElement.parentElement.classList.remove('hidden');

            if (item) {
                document.getElementById('task-id').value = item.id;

                // Fields
                document.getElementById('task-desc').value = item.descricao; // 'O que'
                document.getElementById('task-date').value = item.data || '';
                app.updateDayOfWeek(item.data); // Update on edit logic
                document.getElementById('task-priority').value = item.prioridade;
                document.getElementById('task-category').value = item.categoria;
                let safeStatus = item.status;
                if (safeStatus === 'Concluído') safeStatus = 'Feito';
                if (safeStatus === 'Pendente') safeStatus = 'A fazer';
                document.getElementById('task-status').value = safeStatus;

                document.getElementById('task-como').value = item.como || '';
                document.getElementById('task-onde').value = item.onde || '';
                document.getElementById('task-cta').value = item.cta || '';
                document.getElementById('task-duracao').value = item.duracao || '';
                document.getElementById('task-kpi').value = item.kpi_meta || '';
                document.getElementById('task-tipo-dia').value = item.tipo_dia || '';
                document.getElementById('task-dia-semana').value = item.dia_semana || '';
                document.getElementById('task-tema-macro').value = item.tema_macro || '';
                document.getElementById('task-angulo').value = item.angulo || '';
                document.getElementById('task-canal').value = item.canal_area || '';

                deleteBtn.classList.remove('hidden');
            } else {
                document.getElementById('task-id').value = '';
                deleteBtn.classList.add('hidden');
            }
        }
    },

    closeTaskModal: () => {
        document.getElementById('task-modal').classList.add('hidden');
    },

    handleTaskSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const mode = app.state.modalMode;

        // Common Data
        const dataPayload = {
            descricao: document.getElementById('task-desc').value,
            categoria: document.getElementById('task-category').value,
        };

        let url = '';
        let method = id ? 'PUT' : 'POST';

        if (mode === 'insight') {
            dataPayload.data_prevista = document.getElementById('task-date').value || null;
            dataPayload.status = document.getElementById('task-status').value;

            // Add extended fields
            dataPayload.como = document.getElementById('task-como').value;
            dataPayload.cta = document.getElementById('task-cta').value;
            dataPayload.duracao = document.getElementById('task-duracao').value;
            dataPayload.kpi_meta = document.getElementById('task-kpi').value;
            dataPayload.tipo_dia = document.getElementById('task-tipo-dia').value;
            dataPayload.dia_semana = document.getElementById('task-dia-semana').value;
            dataPayload.tema_macro = document.getElementById('task-tema-macro').value;
            dataPayload.angulo = document.getElementById('task-angulo').value;
            dataPayload.canal_area = document.getElementById('task-canal').value;
            dataPayload.prioridade = document.getElementById('task-priority').value;
            dataPayload.onde = document.getElementById('task-onde').value;

            url = id ? `${API_URL}/insights/${id}` : `${API_URL}/insights`;
        } else {
            // Task
            url = id ? `${API_URL}/tasks/${id}` : `${API_URL}/tasks`;
            // Add all task fields
            dataPayload.data = document.getElementById('task-date').value || null;
            dataPayload.prioridade = document.getElementById('task-priority').value;
            dataPayload.status = document.getElementById('task-status').value;
            dataPayload.como = document.getElementById('task-como').value;
            dataPayload.cta = document.getElementById('task-cta').value;
            dataPayload.duracao = document.getElementById('task-duracao').value;
            dataPayload.kpi_meta = document.getElementById('task-kpi').value;
            dataPayload.tipo_dia = document.getElementById('task-tipo-dia').value;
            dataPayload.dia_semana = document.getElementById('task-dia-semana').value;
            dataPayload.tema_macro = document.getElementById('task-tema-macro').value;
            dataPayload.angulo = document.getElementById('task-angulo').value;
            dataPayload.canal_area = document.getElementById('task-canal').value;
        }

        try {
            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify(dataPayload)
            });

            if (res.ok) {
                app.closeTaskModal();
                app.loadData();
            } else {
                alert("Erro ao salvar.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro de conexão.");
        }
    },

    handleTaskDelete: async () => {
        const id = document.getElementById('task-id').value;
        if (!id) return;
        if (!confirm("Tem certeza que deseja excluir?")) return;

        const mode = app.state.modalMode; // task or insight
        const url = `${API_URL}/${mode}s/${id}`; // tasks or insights

        try {
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
            });
            if (res.ok) {
                app.closeTaskModal();
                app.loadData();
            } else {
                alert("Erro ao excluir.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro de conexão.");
        }
    },

    transformInsightToTask: async (insightId) => {
        if (!confirm('Deseja converter este insight em tarefa?')) return;

        // Use existing endpoint
        try {
            const res = await fetch(`${API_URL}/insights/${insightId}/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
            });
            if (res.ok) {
                alert('Convertido com sucesso!');
                app.closeTaskModal();
                app.loadData();
            } else {
                alert('Erro ao converter insight.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão.');
        }
    },

    renderCalendar: () => {
        const container = document.getElementById('calendar-container');
        container.innerHTML = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const monthName = firstDay.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        const header = document.createElement('div');
        header.className = "flex justify-between items-center mb-4";
        header.innerHTML = `<h3 class="text-xl font-bold text-gray-700 capitalize">${monthName}</h3>`;
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-7 gap-2";

        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
            const d = document.createElement('div');
            d.className = "text-center font-bold text-gray-500 py-2";
            d.innerText = day;
            grid.appendChild(d);
        });

        for (let i = 0; i < firstDay.getDay(); i++) {
            grid.appendChild(document.createElement('div'));
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = "bg-gray-50 h-24 p-2 rounded border hover:bg-white hover:shadow transition-all overflow-y-auto";

            const dateLabel = document.createElement('div');
            dateLabel.className = "text-right text-xs text-gray-400 font-bold mb-1";
            dateLabel.innerText = day;
            cell.appendChild(dateLabel);

            const dayTasks = app.state.tasks.filter(t => t.data === dateStr && t.status !== 'Feito');
            dayTasks.forEach(t => {
                const tDiv = document.createElement('div');
                tDiv.className = "text-xs bg-indigo-100 text-indigo-700 p-1 rounded mb-1 truncate cursor-pointer";
                tDiv.title = t.descricao;
                tDiv.innerText = t.descricao;
                cell.appendChild(tDiv);
            });
            grid.appendChild(cell);
        }
        container.appendChild(grid);
    },

    // Existing renderStrategy is fine
    renderStrategy: () => {
        const list = document.getElementById('strategy-list');
        list.innerHTML = '';
        app.state.strategies.forEach(strat => {
            const div = document.createElement('div');
            div.className = "glass p-4 rounded-lg";
            div.innerHTML = `
                <h3 class="font-bold text-lg text-indigo-900">${strat.tema}</h3>
                <p class="text-sm text-gray-600">Semana: ${strat.semana_inicio} a ${strat.semana_fim}</p>
                <div class="mt-2 text-sm text-gray-800">${strat.descricao_detalhada}</div>
            `;
            list.appendChild(div);
        });
    },

    openShareModal: () => {
        let modal = document.getElementById('share-modal');
        if (!modal) {
            // Create modal dynamically if not exists
            modal = document.createElement('div');
            modal.id = 'share-modal';
            modal.className = "fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50";
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Compartilhar Plano</h3>
                    <p class="text-sm text-gray-500 mb-4">Insira o email com quem deseja compartilhar:</p>
                    <input type="email" id="share-email" class="w-full border rounded p-2 mb-4" placeholder="email@exemplo.com">
                    <div class="flex justify-end space-x-2">
                        <button class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300" onclick="document.getElementById('share-modal').classList.add('hidden')">Cancelar</button>
                        <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700" onclick="app.submitShare()">Compartilhar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
    },

    submitShare: async () => {
        const email = document.getElementById('share-email').value;
        if (!email) return;

        try {
            const res = await fetch(`${API_URL}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify({ email: email, permission: 'read' })
            });
            if (res.ok) {
                alert(`Compartilhado com ${email}!`);
                document.getElementById('share-modal').classList.add('hidden');
                document.getElementById('share-email').value = '';
            } else {
                alert("Erro ao compartilhar.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    },

    // --- IMPORT FUNCTIONALITY ---
    openImportModal: () => {
        document.getElementById('import-file').value = '';
        document.getElementById('import-status').classList.add('hidden');
        document.getElementById('import-result').classList.add('hidden');
        document.getElementById('import-modal').classList.remove('hidden');
    },

    closeImportModal: () => {
        document.getElementById('import-modal').classList.add('hidden');
    },

    handleImportSubmit: async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];

        if (!file) {
            alert('Por favor, selecione um arquivo');
            return;
        }

        const statusDiv = document.getElementById('import-status');
        const resultDiv = document.getElementById('import-result');

        statusDiv.classList.remove('hidden');
        resultDiv.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_URL}/import/excel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: formData
            });

            statusDiv.classList.add('hidden');

            if (res.ok) {
                const data = await res.json();
                resultDiv.innerHTML = `
                    <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p class="font-semibold text-green-800">✅ Importação concluída!</p>
                        <p class="text-sm text-green-700 mt-1">
                            ${data.tasks_imported} tarefas e ${data.strategies_imported} estratégias importadas.
                        </p>
                    </div>
                `;
                resultDiv.classList.remove('hidden');

                // Reload data after 2 seconds
                setTimeout(() => {
                    app.loadData();
                    app.closeImportModal();
                }, 2000);
            } else {
                const err = await res.json();
                resultDiv.innerHTML = `
                    <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p class="font-semibold text-red-800">❌ Erro na importação</p>
                        <p class="text-sm text-red-700 mt-1">${err.detail || 'Erro desconhecido'}</p>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            statusDiv.classList.add('hidden');
            resultDiv.innerHTML = `
                <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="font-semibold text-red-800">❌ Erro de conexão</p>
                    <p class="text-sm text-red-700 mt-1">Não foi possível conectar ao servidor.</p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        }
    },

    // --- DAILY BRIEFING ---
    checkAndShowBriefing: async () => {
        if (!app.state.isAuthenticated) return;

        // Check if user chose not to show today
        const today = new Date().toISOString().split('T')[0];
        const dontShowKey = `briefing_hide_${today}`;

        if (localStorage.getItem(dontShowKey)) {
            return; // User chose not to see it today
        }

        try {
            const res = await fetch(`${API_URL}/briefing/today`, {
                headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
            });

            if (res.ok) {
                const data = await res.json();

                // Only show if there are tasks
                if (data.total_tasks > 0) {
                    app.showBriefing(data);
                }
            }
        } catch (e) {
            console.error('Error loading briefing:', e);
        }
    },

    showBriefing: (data) => {
        const modal = document.getElementById('briefing-modal');
        const dateEl = document.getElementById('briefing-date');
        const contentEl = document.getElementById('briefing-content');

        // Format date
        const dateObj = new Date(data.date + 'T00:00:00');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = dateObj.toLocaleDateString('pt-BR', options);

        // Build content
        contentEl.innerHTML = '';

        if (data.tasks.length === 0) {
            contentEl.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhuma tarefa pendente para hoje! 🎉</p>';
        } else {
            data.tasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'p-4 rounded-lg border-l-4 hover:shadow-md transition-shadow cursor-pointer';

                // Priority colors
                if (task.prioridade === 'Alta') {
                    card.classList.add('bg-red-50', 'border-red-500');
                } else if (task.prioridade === 'Média') {
                    card.classList.add('bg-yellow-50', 'border-yellow-500');
                } else {
                    card.classList.add('bg-blue-50', 'border-blue-500');
                }

                card.innerHTML = `
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="px-2 py-0.5 text-xs font-semibold rounded ${task.prioridade === 'Alta' ? 'bg-red-100 text-red-700' :
                        task.prioridade === 'Média' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                    }">${task.prioridade}</span>
                                <span class="text-xs text-gray-500">${task.categoria}</span>
                            </div>
                            <p class="text-gray-800 font-medium">${task.descricao}</p>
                            ${task.tema_macro ? `<p class="text-sm text-gray-600 mt-1">📌 ${task.tema_macro}</p>` : ''}
                            ${task.duracao ? `<p class="text-xs text-gray-500 mt-1">⏱️ ${task.duracao}</p>` : ''}
                        </div>
                    </div>
                `;

                card.onclick = () => {
                    app.closeBriefing();
                    app.setView('kanban');
                    app.openTaskModal(task, 'task');
                };

                contentEl.appendChild(card);
            });
        }

        modal.classList.remove('hidden');
    },

    closeBriefing: () => {
        const checkbox = document.getElementById('dont-show-today');
        if (checkbox.checked) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`briefing_hide_${today}`, 'true');
        }
        document.getElementById('briefing-modal').classList.add('hidden');
        checkbox.checked = false; // Reset for next time
    },

    updateDayOfWeek: (dateStr) => {
        if (!dateStr) return;
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        // Append T12:00:00 to avoid timezone offset shifts when parsing YYYY-MM-DD
        const date = new Date(dateStr + 'T12:00:00');
        const dayName = days[date.getDay()];
        const field = document.getElementById('task-dia-semana');
        if (field) field.value = dayName;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    document.getElementById('close-modal').addEventListener('click', () => app.toggleModal(false));
});
