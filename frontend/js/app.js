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
        document.getElementById('btn-duplicate-task').addEventListener('click', app.handleTaskDuplicate);
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
            const el = document.getElementById(`${v}-view`);
            if (el) el.classList.add('hidden');
        });
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) targetView.classList.remove('hidden');

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
                if (usersRes.status === 401) {
                    app.logout();
                    return;
                }
                throw new Error("Falha na resposta da API");
            }

            app.state.tasks = await usersRes.json();
            app.state.strategies = await strategiesRes.json();
            app.state.insights = await insightsRes.json();

            if (!Array.isArray(app.state.tasks)) app.state.tasks = [];

            // Normalize task status
            app.state.tasks.forEach(t => {
                if (t.status === 'Pendente') t.status = 'A fazer';
                if (t.status === 'Concluído') t.status = 'Feito';
            });

            app.populateWeeks();
            if (app.state.view === 'table') app.renderTable();
            else app.renderTasks();

            app.renderStrategy();
            app.renderInsights();

            // Admin check
            try {
                const meRes = await fetch(`${API_URL}/auth/me`, { headers });
                if (meRes.ok) {
                    const me = await meRes.json();
                    if (me.role === 'admin') {
                        const adminBtn = document.getElementById('btn-admin-view');
                        if (adminBtn) adminBtn.classList.remove('hidden');
                    }
                }
            } catch (e) { }

        } catch (error) {
            console.error(error);
            alert("Erro ao carregar dados. Verifique a conexão ou aguarde o servidor 'acordar' (pode levar 1 minuto no Render).");
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
                app.renderAdmin();
            } else {
                alert("Erro ao excluir.");
            }
        } catch (e) {
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
            if (!res.ok) {
                alert("Erro ao alterar permissão.");
                app.renderAdmin();
            }
        } catch (e) {
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
                document.getElementById('user-modal').classList.add('hidden');
                app.renderAdmin();
            } else {
                alert("Erro ao criar usuário.");
            }
        } catch (err) {
            alert("Erro de conexão.");
        }
    },

    exportData: () => {
        window.location.href = `${API_URL}/export`;
    },

    toggleModal: (show) => {
        const modal = document.getElementById('checklist-modal');
        if (modal) {
            if (show) modal.classList.remove('hidden');
            else modal.classList.add('hidden');
        }
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
                if (weekTypeSelect.value !== 'all' && dateInput) dateInput.value = '';

                if (app.state.view === 'table') app.renderTable();
                else app.renderTasks();
            });

            weekNumInput.addEventListener('input', () => {
                if (app.state.view === 'table') app.renderTable();
                else app.renderTasks();
            });

            if (dateInput) {
                dateInput.addEventListener('change', () => {
                    if (dateInput.value) {
                        weekTypeSelect.value = 'all';
                        weekNumInput.classList.add('hidden');
                    }
                    if (app.state.view === 'table') app.renderTable();
                    else app.renderTasks();
                });
            }
        };

        setupFilter('');       // Kanban
        setupFilter('-table'); // Table

        // Status and Late Filters
        ['afazer', 'fazendo', 'feito'].forEach(s => {
            const el = document.getElementById(`filter-status-${s}`);
            if (el) el.addEventListener('change', app.renderTasks);
        });
        const lateEl = document.getElementById('filter-late');
        if (lateEl) lateEl.addEventListener('change', app.renderTasks);
    },

    getFilteredTasks: () => {
        let tasks = [...app.state.tasks];
        let suffix = app.state.view === 'table' ? '-table' : '';

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

        // Status and Late Filters
        const afazerEl = document.getElementById('filter-status-afazer');
        const fazendoEl = document.getElementById('filter-status-fazendo');
        const feitoEl = document.getElementById('filter-status-feito');
        const lateEl = document.getElementById('filter-late');

        if (afazerEl && !afazerEl.checked) tasks = tasks.filter(t => t.status !== 'A fazer');
        if (fazendoEl && !fazendoEl.checked) tasks = tasks.filter(t => t.status !== 'Fazendo');
        if (feitoEl && !feitoEl.checked) tasks = tasks.filter(t => t.status !== 'Feito');

        if (lateEl && lateEl.checked) {
            const today = new Date().toISOString().split('T')[0];
            tasks = tasks.filter(t => t.data < today && t.status !== 'Feito');
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

        Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

        let tasks = app.getFilteredTasks();
        let countVals = { 'A fazer': 0, 'Fazendo': 0, 'Feito': 0 };

        if (cols['A fazer']) {
            const addBtn = document.createElement('button');
            addBtn.className = "w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-indigo-500 hover:text-indigo-500 transition-colors mb-2 font-medium text-sm";
            addBtn.innerHTML = "+ Nova Tarefa";
            addBtn.onclick = () => app.openTaskModal(null, 'task');
            cols['A fazer'].appendChild(addBtn);
        }

        tasks.forEach(task => {
            let status = task.status;
            if (status === 'Pendente') status = 'A fazer';
            if (status === 'Concluído') status = 'Feito';
            if (!cols[status]) status = 'A fazer';

            countVals[status]++;

            const card = document.createElement('div');
            card.draggable = true;
            card.ondragstart = (e) => app.drag(e, task.id);
            card.className = "bg-white p-3 rounded shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer select-none";
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
            card.onclick = () => app.openTaskModal(task, 'task');
            if (cols[status]) cols[status].appendChild(card);
        });

        Object.keys(counts).forEach(k => { if (counts[k]) counts[k].innerText = countVals[k]; });
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

        const task = app.state.tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        task.status = newStatus;
        app.renderTasks();

        try {
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.accessToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) app.loadData();
        } catch (e) {
            app.loadData();
        }
    },

    getWeekNumber: (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    /* --- TABLE --- */
    renderTable: () => {
        const tbody = document.getElementById('tasks-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let tasks = app.getFilteredTasks();
        tasks.sort((a, b) => new Date(a.data) - new Date(b.data));

        tasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";
            let dateDisplay = '';
            if (task.data) {
                const [y, m, d] = task.data.split('-');
                dateDisplay = `${d}/${m}/${y}`;
            }

            let st = task.status;
            let badgeColor = (st === 'Feito' || st === 'Concluído') ? 'bg-green-100 text-green-800' :
                (st === 'Fazendo') ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${dateDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.dia_semana || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.tipo_dia || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">${task.tema_macro || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">${task.angulo || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.canal_area || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-900 font-medium truncate max-w-xs">${task.descricao}</td>
                <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">${task.como || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">${task.kpi_meta || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">${task.duracao || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">${task.cta || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${st}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 mr-2" onclick='app.openTaskModal(${JSON.stringify(task).replace(/'/g, "&quot;")}, "task")'>Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    /* --- INSIGHTS --- */
    renderInsights: () => {
        const list = document.getElementById('insights-list');
        if (!list) return;
        list.innerHTML = '';

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

    /* --- MODAL --- */
    openTaskModal: (item = null, mode = 'task') => {
        app.state.modalMode = mode;
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        const form = document.getElementById('task-form');
        const deleteBtn = document.getElementById('btn-delete-task');
        const duplicateBtn = document.getElementById('btn-duplicate-task');

        if (modal) modal.classList.remove('hidden');
        if (form) form.reset();
        app.toggleRecursFields();

        const today = new Date().toISOString().split('T')[0];
        const dateField = document.getElementById('task-date');
        if (dateField) {
            dateField.value = today;
            app.updateDayOfWeek(today);
        }

        const oldBtn = document.getElementById('btn-transform-task');
        if (oldBtn) oldBtn.remove();

        if (mode === 'insight') {
            title.innerText = item ? 'Editar Insight' : 'Novo Insight';
            if (item) {
                document.getElementById('task-id').value = item.id;
                document.getElementById('task-desc').value = item.descricao;
                document.getElementById('task-category').value = item.categoria;
                document.getElementById('task-date').value = item.data_prevista || today;
                document.getElementById('task-status').value = item.status || 'A fazer';
                document.getElementById('task-priority').value = item.prioridade || 'Média';

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
                duplicateBtn.classList.add('hidden');

                const transBtn = document.createElement('button');
                transBtn.id = "btn-transform-task";
                transBtn.type = "button";
                transBtn.className = "text-indigo-600 hover:text-indigo-800 text-sm font-medium ml-4";
                transBtn.innerText = "✨ Transformar em Tarefa";
                transBtn.onclick = () => app.transformInsightToTask(item.id);
                deleteBtn.insertAdjacentElement('afterend', transBtn);
            } else {
                document.getElementById('task-id').value = '';
                deleteBtn.classList.add('hidden');
                duplicateBtn.classList.add('hidden');
            }
        } else {
            title.innerText = item ? 'Editar Tarefa' : 'Nova Tarefa';
            if (item) {
                document.getElementById('task-id').value = item.id;
                document.getElementById('task-desc').value = item.descricao;
                document.getElementById('task-date').value = item.data || '';
                app.updateDayOfWeek(item.data);
                document.getElementById('task-priority').value = item.prioridade;
                document.getElementById('task-category').value = item.categoria;
                document.getElementById('task-status').value = (item.status === 'Concluído' ? 'Feito' : (item.status === 'Pendente' ? 'A fazer' : item.status));

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
                duplicateBtn.classList.remove('hidden');
            } else {
                document.getElementById('task-id').value = '';
                deleteBtn.classList.add('hidden');
                duplicateBtn.classList.add('hidden');
            }
        }
    },

    toggleRecursFields: () => {
        const typeEl = document.getElementById('task-recurs-type');
        if (!typeEl) return;
        const type = typeEl.value;
        const nDaysGroup = document.getElementById('recurs-n-dias-group');
        const weekGroup = document.getElementById('recurs-week-group');
        const monthGroup = document.getElementById('recurs-month-group');
        const rangeGroup = document.getElementById('recurs-range-group');

        if (nDaysGroup) nDaysGroup.classList.add('hidden');
        if (weekGroup) weekGroup.classList.add('hidden');
        if (monthGroup) monthGroup.classList.add('hidden');
        if (rangeGroup) rangeGroup.classList.add('hidden');

        if (type === 'n_dias' && nDaysGroup) nDaysGroup.classList.remove('hidden');
        if (type === 'dia_semana' && weekGroup) weekGroup.classList.remove('hidden');
        if (type === 'dia_mes' && monthGroup) monthGroup.classList.remove('hidden');

        if (type && rangeGroup) {
            rangeGroup.classList.remove('hidden');
            const startField = document.getElementById('task-recurs-start');
            const endField = document.getElementById('task-recurs-end');
            if (startField && !startField.value) {
                const now = new Date();
                const start = now.toISOString().split('T')[0];
                now.setMonth(now.getMonth() + 1);
                const end = now.toISOString().split('T')[0];
                startField.value = start;
                if (endField) endField.value = end;
            }
        }
    },

    closeTaskModal: () => {
        const modal = document.getElementById('task-modal');
        if (modal) modal.classList.add('hidden');
    },

    handleTaskSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const mode = app.state.modalMode;
        const dataPayload = {
            descricao: document.getElementById('task-desc').value,
            categoria: document.getElementById('task-category').value,
            como: document.getElementById('task-como').value,
            onde: document.getElementById('task-onde').value,
            cta: document.getElementById('task-cta').value,
            duracao: document.getElementById('task-duracao').value,
            kpi_meta: document.getElementById('task-kpi').value,
            tipo_dia: document.getElementById('task-tipo-dia').value,
            dia_semana: document.getElementById('task-dia-semana').value,
            tema_macro: document.getElementById('task-tema-macro').value,
            angulo: document.getElementById('task-angulo').value,
            canal_area: document.getElementById('task-canal').value,
            prioridade: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value
        };

        try {
            if (mode === 'insight') {
                dataPayload.data_prevista = document.getElementById('task-date').value || null;
                const res = await fetch(id ? `${API_URL}/insights/${id}` : `${API_URL}/insights`, {
                    method: id ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${app.state.accessToken}` },
                    body: JSON.stringify(dataPayload)
                });
                if (res.ok) { app.closeTaskModal(); app.loadData(); }
                else { alert('Erro ao salvar insight.'); }
            } else {
                dataPayload.data = document.getElementById('task-date').value || null;
                const recursType = document.getElementById('task-recurs-type').value;
                if (recursType && !id) {
                    const recursEnd = document.getElementById('task-recurs-end').value;
                    if (!recursEnd) {
                        alert('A data final da recorrência é obrigatória.');
                        return;
                    }
                    dataPayload.recorrencia_tipo = recursType;
                    dataPayload.recorrencia_inicio = document.getElementById('task-recurs-start').value || dataPayload.data;
                    dataPayload.recorrencia_fim = recursEnd;
                    if (recursType === 'n_dias') dataPayload.recorrencia_intervalo = parseInt(document.getElementById('task-recurs-interval').value);
                    if (recursType === 'dia_mes') dataPayload.recorrencia_dia_mes = parseInt(document.getElementById('task-recurs-day-mes').value);
                    if (recursType === 'dia_semana') {
                        const days = Array.from(document.querySelectorAll('.recurs-weekday:checked')).map(cb => cb.value);
                        dataPayload.recorrencia_dias_semana = days.join(',');
                    }
                }
                const res = await fetch(id ? `${API_URL}/tasks/${id}` : `${API_URL}/tasks`, {
                    method: id ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${app.state.accessToken}` },
                    body: JSON.stringify(dataPayload)
                });
                if (res.ok) {
                    app.closeTaskModal();
                    app.loadData();
                } else {
                    const error = await res.json();
                    alert('Erro ao salvar: ' + (error.detail || 'Verifique os dados.'));
                }
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('Erro de conexão com o servidor.');
        }
    },

    handleTaskDelete: async () => {
        const id = document.getElementById('task-id').value;
        if (!id || !confirm("Tem certeza que deseja excluir?")) return;
        const res = await fetch(`${API_URL}/${app.state.modalMode}s/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
        });
        if (res.ok) { app.closeTaskModal(); app.loadData(); }
    },

    handleTaskDuplicate: async () => {
        const id = document.getElementById('task-id').value;
        if (!id) return;
        const res = await fetch(`${API_URL}/tasks/${id}/duplicate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
        });
        if (res.ok) {
            const newTask = await res.json();
            app.closeTaskModal();
            await app.loadData();
            app.openTaskModal(newTask, 'task');
        }
    },

    transformInsightToTask: async (insightId) => {
        if (!confirm('Deseja converter este insight em tarefa?')) return;
        const res = await fetch(`${API_URL}/insights/${insightId}/convert`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${app.state.accessToken}` }
        });
        if (res.ok) { app.closeTaskModal(); app.loadData(); }
    },

    renderCalendar: () => {
        const container = document.getElementById('calendar-container');
        if (!container) return;
        container.innerHTML = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-7 gap-2";
        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => {
            const el = document.createElement('div');
            el.className = "text-center font-bold text-gray-500 py-2";
            el.innerText = d;
            grid.appendChild(el);
        });
        for (let i = 0; i < firstDay.getDay(); i++) grid.appendChild(document.createElement('div'));
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = "bg-gray-50 h-24 p-2 rounded border overflow-y-auto";
            cell.innerHTML = `<div class="text-right text-xs text-gray-400 font-bold">${day}</div>`;
            app.state.tasks.filter(t => t.data === dateStr && t.status !== 'Feito').forEach(t => {
                const el = document.createElement('div');
                el.className = "text-xs bg-indigo-100 text-indigo-700 p-1 rounded mb-1 truncate";
                el.innerText = t.descricao;
                cell.appendChild(el);
            });
            grid.appendChild(cell);
        }
        container.appendChild(grid);
    },

    renderStrategy: () => {
        const list = document.getElementById('strategy-list');
        if (!list) return;
        list.innerHTML = '';
        app.state.strategies.forEach(s => {
            const div = document.createElement('div');
            div.className = "glass p-4 rounded-lg";
            div.innerHTML = `<h3 class="font-bold text-indigo-900">${s.tema}</h3><p class="text-sm text-gray-600">Semana: ${s.semana_inicio} a ${s.semana_fim}</p><div class="mt-2 text-sm text-gray-800">${s.descricao_detalhada}</div>`;
            list.appendChild(div);
        });
    },

    openShareModal: () => {
        let modal = document.getElementById('share-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'share-modal';
            modal.className = "fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50";
            modal.innerHTML = `<div class="bg-white rounded-lg p-6 w-96 shadow-xl"><h3 class="text-xl font-bold mb-4">Compartilhar Plano</h3><input type="email" id="share-email" class="w-full border rounded p-2 mb-4" placeholder="email@exemplo.com"><div class="flex justify-end space-x-2"><button class="px-3 py-1 bg-gray-200 rounded" onclick="document.getElementById('share-modal').classList.add('hidden')">Cancelar</button><button class="px-3 py-1 bg-indigo-600 text-white rounded" onclick="app.submitShare()">Compartilhar</button></div></div>`;
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
    },

    submitShare: async () => {
        const email = document.getElementById('share-email').value;
        if (email) {
            const res = await fetch(`${API_URL}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${app.state.accessToken}` },
                body: JSON.stringify({ email: email, permission: 'read' })
            });
            if (res.ok) { alert('Compartilhado!'); document.getElementById('share-modal').classList.add('hidden'); }
        }
    },

    openImportModal: () => {
        const modal = document.getElementById('import-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeImportModal: () => {
        const modal = document.getElementById('import-modal');
        if (modal) modal.classList.add('hidden');
    },

    handleImportSubmit: async (e) => {
        e.preventDefault();
        const file = document.getElementById('import-file').files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_URL}/import/excel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${app.state.accessToken}` },
            body: formData
        });
        if (res.ok) { app.loadData(); app.closeImportModal(); }
    },

    checkAndShowBriefing: async () => {
        if (!app.state.isAuthenticated) return;
        const today = new Date().toISOString().split('T')[0];
        if (localStorage.getItem(`briefing_hide_${today}`)) return;
        const res = await fetch(`${API_URL}/briefing/today`, { headers: { 'Authorization': `Bearer ${app.state.accessToken}` } });
        if (res.ok) {
            const data = await res.json();
            if (data.total_tasks > 0) app.showBriefing(data);
        }
    },

    showBriefing: (data) => {
        const modal = document.getElementById('briefing-modal');
        const content = document.getElementById('briefing-content');
        if (content) {
            content.innerHTML = '';
            data.tasks.forEach(t => {
                const el = document.createElement('div');
                el.className = 'p-3 rounded border mb-2 cursor-pointer hover:bg-gray-50';
                el.innerHTML = `<div class="font-bold">${t.descricao}</div><div class="text-xs text-gray-500">${t.categoria}</div>`;
                el.onclick = () => { app.closeBriefing(); app.openTaskModal(t, 'task'); };
                content.appendChild(el);
            });
        }
        if (modal) modal.classList.remove('hidden');
    },

    closeBriefing: () => {
        const checkbox = document.getElementById('dont-show-today');
        if (checkbox && checkbox.checked) localStorage.setItem(`briefing_hide_${new Date().toISOString().split('T')[0]}`, 'true');
        const modal = document.getElementById('briefing-modal');
        if (modal) modal.classList.add('hidden');
    },

    updateDayOfWeek: (dateStr) => {
        if (!dateStr) return;
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dayName = days[new Date(dateStr + 'T12:00:00').getDay()];
        const field = document.getElementById('task-dia-semana');
        if (field) field.value = dayName;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => app.toggleModal(false));
});
