class TasksPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tasks = {
      needOwner: [],
      withOwnerIncomplete: [],
      completed: [],
    };
    this.completedCollapsed = true;
    this.needOwnerCollapsed = false;
    this.withOwnerIncompleteCollapsed = false;
  }

  connectedCallback() {
    console.log("Tasks Page - connectedCallback");
    this.render();
    this.loadTasks();
    this.setupEventListeners();
  }

  async loadTasks() {
    try {
      // Load tasks from Google Sheets "Tasks" tab
      const sheetsAPI = window.sheetsAPI;
      if (!sheetsAPI) {
        console.warn("sheetsAPI not available");
        this.renderTasks();
        return;
      }

      const tasks = await sheetsAPI.fetchTasksData();

      // Organize tasks by status
      this.tasks.needOwner = tasks.filter((t) => t.status === "needOwner");
      this.tasks.withOwnerIncomplete = tasks.filter(
        (t) => t.status === "withOwnerIncomplete"
      );
      this.tasks.completed = tasks.filter((t) => t.status === "completed");

      this.renderTasks();
    } catch (error) {
      console.error("Error loading tasks:", error);
      this.renderTasks();
    }
  }

  setupEventListeners() {
    // Add task button
    const addBtn = this.shadowRoot.querySelector("#addTaskBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.showAddTaskModal());
    }

    // Section toggles
    const needOwnerHeader = this.shadowRoot.querySelector("#needOwnerHeader");
    if (needOwnerHeader) {
      needOwnerHeader.addEventListener("click", () => this.toggleNeedOwner());
    }

    const withOwnerIncompleteHeader = this.shadowRoot.querySelector(
      "#withOwnerIncompleteHeader"
    );
    if (withOwnerIncompleteHeader) {
      withOwnerIncompleteHeader.addEventListener("click", () =>
        this.toggleWithOwnerIncomplete()
      );
    }

    const completedHeader = this.shadowRoot.querySelector("#completedHeader");
    if (completedHeader) {
      completedHeader.addEventListener("click", () => this.toggleCompleted());
    }
  }

  toggleNeedOwner() {
    this.needOwnerCollapsed = !this.needOwnerCollapsed;
    const container = this.shadowRoot.querySelector("#needOwnerTasks");
    const icon = this.shadowRoot.querySelector("#needOwnerToggleIcon");

    if (container) {
      container.style.display = this.needOwnerCollapsed ? "none" : "block";
    }
    if (icon) {
      icon.textContent = this.needOwnerCollapsed ? "+" : "-";
    }
  }

  toggleWithOwnerIncomplete() {
    this.withOwnerIncompleteCollapsed = !this.withOwnerIncompleteCollapsed;
    const container = this.shadowRoot.querySelector(
      "#withOwnerIncompleteTasks"
    );
    const icon = this.shadowRoot.querySelector(
      "#withOwnerIncompleteToggleIcon"
    );

    if (container) {
      container.style.display = this.withOwnerIncompleteCollapsed
        ? "none"
        : "block";
    }
    if (icon) {
      icon.textContent = this.withOwnerIncompleteCollapsed ? "+" : "-";
    }
  }

  toggleCompleted() {
    this.completedCollapsed = !this.completedCollapsed;
    const container = this.shadowRoot.querySelector("#completedTasks");
    const icon = this.shadowRoot.querySelector("#completedToggleIcon");

    if (container) {
      container.style.display = this.completedCollapsed ? "none" : "block";
    }
    if (icon) {
      icon.textContent = this.completedCollapsed ? "+" : "-";
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
      const dueDateInput = this.shadowRoot.querySelector("#newTaskDueDate");
      if (input) input.value = "";
      if (dueDateInput) dueDateInput.value = "";
    }
  }

  async addTask() {
    const input = this.shadowRoot.querySelector("#newTaskInput");
    const dueDateInput = this.shadowRoot.querySelector("#newTaskDueDate");
    const taskTitle = input?.value?.trim();
    const dueDate = dueDateInput?.value || "";

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
      dueDate: dueDate,
      status: "needOwner",
      createdAt: new Date().toISOString(),
      createdBy: userName,
    };

    this.tasks.needOwner.unshift(newTask);
    this.renderTasks();
    this.hideAddTaskModal();

    // Save to Google Sheets
    try {
      const sheetsAPI = window.sheetsAPI;
      if (sheetsAPI) {
        await sheetsAPI.saveTask(newTask);
      }
    } catch (error) {
      console.error("Error saving task to Google Sheets:", error);
    }
  }

  async volunteerForTask(taskId) {
    // Check if task is in needOwner list
    let taskIndex = this.tasks.needOwner.findIndex((t) => t.id === taskId);
    let task = null;

    if (taskIndex !== -1) {
      // Move from needOwner to pending
      task = this.tasks.needOwner.splice(taskIndex, 1)[0];
      const userName =
        localStorage.getItem("gapi_user_name") || prompt("Enter your name:");
      if (!userName) {
        // Put it back if user cancels
        this.tasks.needOwner.splice(taskIndex, 0, task);
        return;
      }
      task.volunteer = userName;
      task.status = "withOwnerIncomplete";
      this.tasks.withOwnerIncomplete.unshift(task);
    } else {
      // Check if it's already in pending (shouldn't happen, but handle it)
      task = this.tasks.withOwnerIncomplete.find((t) => t.id === taskId);
      if (!task) return;

      const userName =
        localStorage.getItem("gapi_user_name") || prompt("Enter your name:");
      if (!userName) return;

      task.volunteer = userName;
    }

    this.renderTasks();

    // Update Google Sheets
    try {
      const sheetsAPI = window.sheetsAPI;
      if (sheetsAPI) {
        await sheetsAPI.updateTask(task);
      }
    } catch (error) {
      console.error("Error updating task in Google Sheets:", error);
    }
  }

  async completeTask(taskId) {
    const taskIndex = this.tasks.withOwnerIncomplete.findIndex(
      (t) => t.id === taskId
    );
    if (taskIndex === -1) return;

    const task = this.tasks.withOwnerIncomplete.splice(taskIndex, 1)[0];
    task.completedAt = new Date().toISOString();
    task.status = "completed";
    this.tasks.completed.unshift(task);
    this.renderTasks();

    // Update Google Sheets
    try {
      const sheetsAPI = window.sheetsAPI;
      if (sheetsAPI) {
        await sheetsAPI.updateTask(task);
      }
    } catch (error) {
      console.error("Error updating task in Google Sheets:", error);
    }
  }

  async uncompleteTask(taskId) {
    const taskIndex = this.tasks.completed.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.tasks.completed.splice(taskIndex, 1)[0];
    delete task.completedAt;

    // Put back in appropriate list based on whether it has a volunteer
    if (task.volunteer) {
      task.status = "withOwnerIncomplete";
      this.tasks.withOwnerIncomplete.unshift(task);
    } else {
      task.status = "needOwner";
      this.tasks.needOwner.unshift(task);
    }

    this.renderTasks();

    // Update Google Sheets
    try {
      const sheetsAPI = window.sheetsAPI;
      if (sheetsAPI) {
        await sheetsAPI.updateTask(task);
      }
    } catch (error) {
      console.error("Error updating task in Google Sheets:", error);
    }
  }

  deleteTask(taskId, listType = "needOwner") {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const list = this.tasks[listType];
    if (!list) return;

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

  formatDueDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  isDueSoon(dateString) {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const now = new Date();
    const diffMs = dueDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  }

  renderTaskCard(task, listType = "needOwner") {
    const isCompleted = listType === "completed";
    const hasOwner = listType === "pending";
    const dueSoon = this.isDueSoon(task.dueDate);

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
          }, '${listType}')" title="Delete task">
            <i class="mdi mdi-delete"></i>
          </button>
        </div>

        ${
          task.dueDate
            ? `
          <div class="task-due-date ${dueSoon ? "due-soon" : ""}">
            <i class="mdi mdi-calendar-alert"></i>
            Due: ${this.formatDueDate(task.dueDate)}
          </div>
        `
            : ""
        }

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
    const needOwnerContainer = this.shadowRoot.querySelector("#needOwnerTasks");
    const withOwnerIncompleteContainer = this.shadowRoot.querySelector(
      "#withOwnerIncompleteTasks"
    );
    const completedContainer = this.shadowRoot.querySelector("#completedTasks");

    // Auto-collapse empty sections
    if (this.tasks.needOwner.length === 0 && !this.needOwnerCollapsed) {
      this.needOwnerCollapsed = true;
    }
    if (
      this.tasks.withOwnerIncomplete.length === 0 &&
      !this.withOwnerIncompleteCollapsed
    ) {
      this.withOwnerIncompleteCollapsed = true;
    }

    if (needOwnerContainer) {
      if (this.tasks.needOwner.length === 0) {
        needOwnerContainer.innerHTML = `
          <div class="empty-state">
            <i class="mdi mdi-account-question-outline"></i>
            <p>No tasks need an owner</p>
            <p class="empty-state-hint">Click the + button to add a new task</p>
          </div>
        `;
      } else {
        needOwnerContainer.innerHTML = this.tasks.needOwner
          .map((task) => this.renderTaskCard(task, "needOwner"))
          .join("");
      }
      needOwnerContainer.style.display = this.needOwnerCollapsed
        ? "none"
        : "block";
    }

    if (withOwnerIncompleteContainer) {
      if (this.tasks.withOwnerIncomplete.length === 0) {
        withOwnerIncompleteContainer.innerHTML = `
          <div class="empty-state">
            <i class="mdi mdi-clipboard-check-outline"></i>
            <p>No pending tasks</p>
          </div>
        `;
      } else {
        withOwnerIncompleteContainer.innerHTML = this.tasks.withOwnerIncomplete
          .map((task) => this.renderTaskCard(task, "pending"))
          .join("");
      }
      withOwnerIncompleteContainer.style.display = this
        .withOwnerIncompleteCollapsed
        ? "none"
        : "block";
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
          .map((task) => this.renderTaskCard(task, "completed"))
          .join("");
      }
      completedContainer.style.display = this.completedCollapsed
        ? "none"
        : "block";
    }

    // Update counts
    const needOwnerCount = this.shadowRoot.querySelector("#needOwnerCount");
    const withOwnerIncompleteCount = this.shadowRoot.querySelector(
      "#withOwnerIncompleteCount"
    );
    const completedCount = this.shadowRoot.querySelector("#completedCount");
    if (needOwnerCount)
      needOwnerCount.textContent = this.tasks.needOwner.length;
    if (withOwnerIncompleteCount)
      withOwnerIncompleteCount.textContent =
        this.tasks.withOwnerIncomplete.length;
    if (completedCount)
      completedCount.textContent = this.tasks.completed.length;

    // Update toggle icons
    const needOwnerIcon = this.shadowRoot.querySelector("#needOwnerToggleIcon");
    const withOwnerIncompleteIcon = this.shadowRoot.querySelector(
      "#withOwnerIncompleteToggleIcon"
    );
    const completedIcon = this.shadowRoot.querySelector("#completedToggleIcon");
    if (needOwnerIcon)
      needOwnerIcon.textContent = this.needOwnerCollapsed ? "+" : "-";
    if (withOwnerIncompleteIcon)
      withOwnerIncompleteIcon.textContent = this.withOwnerIncompleteCollapsed
        ? "+"
        : "-";
    if (completedIcon)
      completedIcon.textContent = this.completedCollapsed ? "+" : "-";
  }

  render() {
    console.log("Tasks Page - render() called");

    // Import Material Design Icons stylesheet into the document head if not already present
    if (!document.querySelector('link[href*="materialdesignicons"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css";
      document.head.appendChild(link);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-family, 'Atkinson Hyperlegible', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
          max-width: 800px;
          margin: 0 auto;
          padding: 16px;
          background: #f5f5f5;
          min-height: 100%;
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
          padding: 12px;
          border-radius: 8px;
        }

        .section:nth-of-type(1) .section-header {
          background: #fce4ec;
          border-left: 4px solid #ec407a;
        }

        .section:nth-of-type(2) .section-header {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
        }

        .section:nth-of-type(3) .section-header {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
        }

        .section:nth-of-type(4) .section-header {
          background: #f3e5f5;
          border-left: 4px solid #9c27b0;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }

        .section:nth-of-type(1) .section-title {
          color: #c2185b;
        }

        .section:nth-of-type(2) .section-title {
          color: #e65100;
        }

        .section:nth-of-type(3) .section-title {
          color: #1565c0;
        }

        .section:nth-of-type(4) .section-title {
          color: #7b1fa2;
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

        .task-due-date {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.95rem;
          font-weight: 600;
          padding: 8px 12px;
          margin: 8px 0;
          border-radius: 6px;
          background: #e8f5e9;
          color: #2e7d32;
        }

        .task-due-date.due-soon {
          background: #fce4ec;
          color: #880e4f;
          border: 2px solid #880e4f;
        }

        .task-due-date i {
          font-size: 1.1rem;
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

      <div class="section">
        <div class="section-header" id="needOwnerHeader" style="cursor: pointer; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="needOwnerToggleIcon" style="font-weight: bold; font-size: 1.2rem; width: 20px; text-align: center;">-</span>
            <h3 class="section-title">Need Owner</h3>
          </div>
          <span class="task-count" id="needOwnerCount">0</span>
        </div>
        <div id="needOwnerTasks">
          <div class="empty-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header" id="withOwnerIncompleteHeader" style="cursor: pointer; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="withOwnerIncompleteToggleIcon" style="font-weight: bold; font-size: 1.2rem; width: 20px; text-align: center;">-</span>
            <h3 class="section-title">With Owner Incomplete</h3>
          </div>
          <span class="task-count" id="withOwnerIncompleteCount">0</span>
        </div>
        <div id="withOwnerIncompleteTasks">
          <div class="empty-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header" id="completedHeader" style="cursor: pointer; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="completedToggleIcon" style="font-weight: bold; font-size: 1.2rem; width: 20px; text-align: center;">+</span>
            <h3 class="section-title">Completed</h3>
          </div>
          <span class="task-count" id="completedCount">0</span>
        </div>
        <div id="completedTasks" style="display: none;">
          <div class="empty-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <div style="padding: 16px; background: #f3e5f5; border-left: 4px solid #9c27b0; border-radius: 8px;">
        <button id="addTaskBtn" class="btn btn-primary" style="width: 100%; background: #9c27b0; border: none;">
          <i class="mdi mdi-plus-circle"></i> Add New Task
        </button>
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
              />
            </div>
            <div class="form-group">
              <label class="form-label">Due Date (optional)</label>
              <input
                type="date"
                id="newTaskDueDate"
                class="form-input"
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
