class TasksPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tasks = {
      pending: [],
      completed: [],
    };
  }

  connectedCallback() {
    console.log("Tasks Page - connectedCallback");
    this.render();
    this.loadTasks();
    this.setupEventListeners();
  }

  async loadTasks() {
    try {
      // TODO: Load tasks from Google Sheets
      // For now, using mock data for demo
      this.tasks.pending = [
        {
          id: Date.now() + 1,
          title: "Order more boxes for food distribution",
          volunteer: "",
          createdAt: new Date().toISOString(),
          createdBy: "Admin",
        },
        {
          id: Date.now() + 2,
          title: "Check van tire pressure",
          volunteer: "John Smith",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: "Admin",
        },
      ];

      this.tasks.completed = [
        {
          id: Date.now() - 1000,
          title: "Update contact information for markets",
          volunteer: "Jane Doe",
          completedAt: new Date(Date.now() - 172800000).toISOString(),
          createdBy: "Admin",
        },
      ];

      this.renderTasks();
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }

  setupEventListeners() {
    // Add task button
    const addBtn = this.shadowRoot.querySelector("#addTaskBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.showAddTaskModal());
    }
  }

  showAddTaskModal() {
    const modal = this.shadowRoot.querySelector("#addTaskModal");
    if (modal) {
      modal.style.display = "flex";
      const input = this.shadowRoot.querySelector("#newTaskInput");
      if (input) input.focus();
    }
  }

  hideAddTaskModal() {
    const modal = this.shadowRoot.querySelector("#addTaskModal");
    if (modal) {
      modal.style.display = "none";
      const input = this.shadowRoot.querySelector("#newTaskInput");
      if (input) input.value = "";
    }
  }

  async addTask() {
    const input = this.shadowRoot.querySelector("#newTaskInput");
    const taskTitle = input?.value?.trim();

    if (!taskTitle) {
      alert("Please enter a task description");
      return;
    }

    // Get current user name from localStorage or use "Anonymous"
    const userName = localStorage.getItem("gapi_user_name") || "Anonymous";

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      volunteer: "",
      createdAt: new Date().toISOString(),
      createdBy: userName,
    };

    this.tasks.pending.unshift(newTask);
    this.renderTasks();
    this.hideAddTaskModal();

    // TODO: Save to Google Sheets
    console.log("New task created:", newTask);
  }

  volunteerForTask(taskId) {
    const task = this.tasks.pending.find((t) => t.id === taskId);
    if (!task) return;

    const userName =
      localStorage.getItem("gapi_user_name") || prompt("Enter your name:");
    if (!userName) return;

    task.volunteer = userName;
    this.renderTasks();

    // TODO: Update Google Sheets
    console.log("Volunteered for task:", task);
  }

  completeTask(taskId) {
    const taskIndex = this.tasks.pending.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.tasks.pending.splice(taskIndex, 1)[0];
    task.completedAt = new Date().toISOString();
    this.tasks.completed.unshift(task);
    this.renderTasks();

    // TODO: Update Google Sheets
    console.log("Task completed:", task);
  }

  uncompleteTask(taskId) {
    const taskIndex = this.tasks.completed.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.tasks.completed.splice(taskIndex, 1)[0];
    delete task.completedAt;
    this.tasks.pending.unshift(task);
    this.renderTasks();

    // TODO: Update Google Sheets
    console.log("Task uncompleted:", task);
  }

  deleteTask(taskId, isCompleted = false) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const list = isCompleted ? this.tasks.completed : this.tasks.pending;
    const taskIndex = list.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    list.splice(taskIndex, 1);
    this.renderTasks();

    // TODO: Delete from Google Sheets
    console.log("Task deleted:", taskId);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  renderTaskCard(task, isCompleted = false) {
    return `
      <div class="task-card ${isCompleted ? "completed" : ""}">
        <div class="task-header">
          <div class="task-title">${task.title}</div>
          ${
            isCompleted
              ? `
            <button class="icon-btn" onclick="this.getRootNode().host.uncompleteTask(${task.id})" title="Move back to pending">
              <i class="mdi mdi-undo"></i>
            </button>
          `
              : ""
          }
          <button class="icon-btn delete-btn" onclick="this.getRootNode().host.deleteTask(${
            task.id
          }, ${isCompleted})" title="Delete task">
            <i class="mdi mdi-delete"></i>
          </button>
        </div>

        <div class="task-meta">
          <span class="task-date">
            <i class="mdi mdi-clock-outline"></i>
            ${
              isCompleted
                ? `Completed ${this.formatDate(task.completedAt)}`
                : `Created ${this.formatDate(task.createdAt)}`
            }
          </span>
          <span class="task-creator">by ${task.createdBy}</span>
        </div>

        ${
          !isCompleted
            ? `
          <div class="task-actions">
            <div class="volunteer-section">
              ${
                task.volunteer
                  ? `
                <span class="volunteer-name">
                  <i class="mdi mdi-account"></i>
                  ${task.volunteer}
                </span>
              `
                  : `
                <button class="volunteer-btn" onclick="this.getRootNode().host.volunteerForTask(${task.id})">
                  <i class="mdi mdi-hand-heart"></i>
                  I'll do this
                </button>
              `
              }
            </div>

            ${
              task.volunteer
                ? `
              <button class="complete-btn" onclick="this.getRootNode().host.completeTask(${task.id})">
                <i class="mdi mdi-check-circle"></i>
                Mark Complete
              </button>
            `
                : ""
            }
          </div>
        `
            : `
          <div class="completed-by">
            <i class="mdi mdi-check-circle"></i>
            Completed by ${task.volunteer || "Unknown"}
          </div>
        `
        }
      </div>
    `;
  }

  renderTasks() {
    const pendingContainer = this.shadowRoot.querySelector("#pendingTasks");
    const completedContainer = this.shadowRoot.querySelector("#completedTasks");

    if (pendingContainer) {
      if (this.tasks.pending.length === 0) {
        pendingContainer.innerHTML = `
          <div class="empty-state">
            <i class="mdi mdi-clipboard-check-outline"></i>
            <p>No pending tasks</p>
            <p class="empty-state-hint">Click the + button to add a new task</p>
          </div>
        `;
      } else {
        pendingContainer.innerHTML = this.tasks.pending
          .map((task) => this.renderTaskCard(task, false))
          .join("");
      }
    }

    if (completedContainer) {
      if (this.tasks.completed.length === 0) {
        completedContainer.innerHTML = `
          <div class="empty-state">
            <i class="mdi mdi-checkbox-marked-circle-outline"></i>
            <p>No completed tasks yet</p>
          </div>
        `;
      } else {
        completedContainer.innerHTML = this.tasks.completed
          .map((task) => this.renderTaskCard(task, true))
          .join("");
      }
    }

    // Update counts
    const pendingCount = this.shadowRoot.querySelector("#pendingCount");
    const completedCount = this.shadowRoot.querySelector("#completedCount");
    if (pendingCount) pendingCount.textContent = this.tasks.pending.length;
    if (completedCount)
      completedCount.textContent = this.tasks.completed.length;
  }

  render() {
    console.log("Tasks Page - render() called");
    this.shadowRoot.innerHTML = `
      <style>
        @import url("https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css");

        :host {
          display: block;
          font-family: var(--font-family, 'Atkinson Hyperlegible', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
          border-radius: 12px;
          color: white;
          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
        }

        .page-title {
          margin: 0;
          font-size: var(--font-size-xl, 1.5rem);
          font-weight: 700;
        }

        #addTaskBtn {
          background: white;
          color: #3182ce;
          border: none;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        #addTaskBtn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e0e0e0;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a365d;
          margin: 0;
        }

        .task-count {
          background: #3182ce;
          color: white;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .task-card {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
        }

        .task-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-color: #3182ce;
        }

        .task-card.completed {
          opacity: 0.8;
          background: #f8f9fa;
        }

        .task-header {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }

        .task-title {
          flex: 1;
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
          line-height: 1.4;
        }

        .task-card.completed .task-title {
          text-decoration: line-through;
          color: #666;
        }

        .task-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.9rem;
          color: #666;
        }

        .task-date {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .task-creator {
          color: #888;
        }

        .task-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e0e0e0;
        }

        .volunteer-section {
          flex: 1;
        }

        .volunteer-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .volunteer-btn:hover {
          background: #218838;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
        }

        .volunteer-name {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #e3f2fd;
          color: #1976d2;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 600;
        }

        .complete-btn {
          background: #3182ce;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .complete-btn:hover {
          background: #2c5282;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(49, 130, 206, 0.3);
        }

        .completed-by {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #28a745;
          font-weight: 600;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
        }

        .icon-btn {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          background: #f0f0f0;
          color: #333;
        }

        .icon-btn.delete-btn:hover {
          background: #fee;
          color: #dc3545;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }

        .empty-state i {
          font-size: 4rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 8px 0;
          font-size: 1.1rem;
        }

        .empty-state-hint {
          font-size: 0.9rem !important;
          color: #bbb;
        }

        /* Modal Styles */
        #addTaskModal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #1a365d;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #999;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }

        .close-btn:hover {
          color: #333;
        }

        .modal-body {
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }

        .form-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-family: inherit;
          font-size: 1rem;
          transition: border-color 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #3182ce;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #3182ce;
          color: white;
        }

        .btn-primary:hover {
          background: #2c5282;
        }

        .btn-secondary {
          background: #e0e0e0;
          color: #333;
        }

        .btn-secondary:hover {
          background: #d0d0d0;
        }

        @media (max-width: 600px) {
          :host {
            padding: 12px;
          }

          .page-header {
            padding: 16px;
          }

          .task-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .complete-btn,
          .volunteer-btn {
            width: 100%;
            justify-content: center;
          }
        }
      </style>

      <div class="page-header">
        <h2 class="page-title">
          <i class="mdi mdi-clipboard-list-outline"></i> Tasks
        </h2>
        <button id="addTaskBtn" title="Add new task">+</button>
      </div>

      <div class="section">
        <div class="section-header">
          <h3 class="section-title">Pending</h3>
          <span class="task-count" id="pendingCount">0</span>
        </div>
        <div id="pendingTasks">
          <div class="empty-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h3 class="section-title">Completed</h3>
          <span class="task-count" id="completedCount">0</span>
        </div>
        <div id="completedTasks">
          <div class="empty-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <!-- Add Task Modal -->
      <div id="addTaskModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Add New Task</h3>
            <button class="close-btn" onclick="this.getRootNode().host.hideAddTaskModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">What needs to be done?</label>
              <input
                type="text"
                id="newTaskInput"
                class="form-input"
                placeholder="e.g., Order more boxes for food distribution"
                onkeypress="if(event.key==='Enter') this.getRootNode().host.addTask()"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="this.getRootNode().host.hideAddTaskModal()">Cancel</button>
            <button class="btn btn-primary" onclick="this.getRootNode().host.addTask()">Add Task</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("tasks-page", TasksPage);
