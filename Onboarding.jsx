
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Onboarding.css";

const API_URL = "http://127.0.0.1:8000";

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.employees)) return data.employees;
  return [];
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error) {
  return (
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

function Onboarding() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const role = String(localStorage.getItem("user_role") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();

  const isManager = role === "HR" || role === "ADMIN";

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [progress, setProgress] = useState(null);

  const [employeeId, setEmployeeId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [filterEmployee, setFilterEmployee] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const handleUnauthorized = useCallback(
    (requestError) => {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return true;
      }
      return false;
    },
    [navigate]
  );

  const loadManagerData = useCallback(async () => {
    const [employeeResponse, taskResponse] = await Promise.all([
      axios.get(`${API_URL}/api/v1/employees/`, authConfig),
      axios.get(`${API_URL}/api/v1/onboarding/tasks`, authConfig),
    ]);

    const employeeList = getItems(employeeResponse.data).filter((employee) => {
      const employeeRole = String(
        employee.role?.value || employee.role || ""
      ).toUpperCase();

      return employeeRole === "EMPLOYEE";
    });

    setEmployees(employeeList);
    setTasks(getItems(taskResponse.data));
  }, [authConfig]);

  const loadEmployeeData = useCallback(async () => {
    const [taskResponse, progressResponse] = await Promise.all([
      axios.get(`${API_URL}/api/v1/onboarding/me`, authConfig),
      axios.get(`${API_URL}/api/v1/onboarding/progress/me`, authConfig),
    ]);

    setTasks(getItems(taskResponse.data));
    setProgress(progressResponse.data || null);
  }, [authConfig]);

  const refreshData = useCallback(async () => {
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isManager) {
        await loadManagerData();
      } else {
        await loadEmployeeData();
      }
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, [
    token,
    isManager,
    navigate,
    loadManagerData,
    loadEmployeeData,
    handleUnauthorized,
  ]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleAssignTask = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!employeeId || !taskName.trim()) {
      setError("Please select an employee and enter a task name.");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/onboarding/tasks`,
        {
          employee_id: Number(employeeId),
          task_name: taskName.trim(),
          due_date: dueDate || null,
        },
        authConfig
      );

      setTaskName("");
      setDueDate("");
      setEmployeeId("");
      setSuccess("Onboarding task assigned successfully.");
      await loadManagerData();
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    setError("");
    setSuccess("");
    setCompletingId(taskId);

    try {
      await axios.patch(
        `${API_URL}/api/v1/onboarding/tasks/${taskId}/complete`,
        {},
        authConfig
      );

      setSuccess("Task marked as completed.");
      await loadEmployeeData();
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setCompletingId(null);
    }
  };

  const visibleTasks = useMemo(() => {
    if (!isManager || filterEmployee === "ALL") return tasks;

    return tasks.filter(
      (task) => String(task.employee_id) === String(filterEmployee)
    );
  }, [tasks, isManager, filterEmployee]);

  const managerProgress = useMemo(() => {
    const grouped = {};

    tasks.forEach((task) => {
      const id = String(task.employee_id);

      if (!grouped[id]) {
        grouped[id] = {
          total: 0,
          completed: 0,
          pending: 0,
        };
      }

      grouped[id].total += 1;

      if (String(task.status).toUpperCase() === "COMPLETED") {
        grouped[id].completed += 1;
      } else {
        grouped[id].pending += 1;
      }
    });

    return Object.entries(grouped).map(([id, item]) => {
      const employee = employees.find(
        (person) => String(person.id) === id
      );

      return {
        id,
        name: employee?.username || employee?.email || `Employee ${id}`,
        ...item,
        percentage:
          item.total > 0
            ? Math.round((item.completed / item.total) * 100)
            : 0,
      };
    });
  }, [tasks, employees]);

  const completedCount = isManager
    ? tasks.filter(
        (task) => String(task.status).toUpperCase() === "COMPLETED"
      ).length
    : Number(progress?.completed_tasks || 0);

  const pendingCount = isManager
    ? tasks.filter(
        (task) => String(task.status).toUpperCase() !== "COMPLETED"
      ).length
    : Number(progress?.pending_tasks || 0);

  const totalCount = isManager
    ? tasks.length
    : Number(progress?.total_tasks || 0);

  const completionPercentage = isManager
    ? totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 0
    : Number(progress?.completion_percentage || 0);

  if (loading) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-loading">
          Loading onboarding details...
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <div>
          <p className="onboarding-eyebrow">WORKSPHERE HRMS</p>
          <h1>Employee Onboarding</h1>
          <p className="onboarding-subtitle">
            Assign, manage and track employee onboarding tasks.
          </p>
        </div>

        <div className="onboarding-header-actions">
          <button
            type="button"
            className="onboarding-back-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <button
            type="button"
            className="onboarding-refresh"
            onClick={refreshData}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="onboarding-alert onboarding-error">{error}</div>
      )}

      {success && (
        <div className="onboarding-alert onboarding-success">{success}</div>
      )}

      <div className="onboarding-stats">
        <div className="onboarding-stat-card">
          <span>Total Tasks</span>
          <strong>{totalCount}</strong>
        </div>
        <div className="onboarding-stat-card">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="onboarding-stat-card">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="onboarding-stat-card">
          <span>Completion</span>
          <strong>{completionPercentage}%</strong>
        </div>
      </div>

      <section className="onboarding-panel onboarding-progress-panel">
        <div className="onboarding-section-heading">
          <div>
            <h2>Onboarding Progress</h2>
            <p>Overall completion of assigned onboarding tasks.</p>
          </div>
          <strong className="onboarding-percentage">
            {completionPercentage}%
          </strong>
        </div>

        <div
          className="onboarding-progress-track"
          role="progressbar"
          aria-valuenow={completionPercentage}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="onboarding-progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, completionPercentage))}%`,
            }}
          />
        </div>
      </section>

      {isManager ? (
        <>
          <section className="onboarding-panel">
            <div className="onboarding-section-heading">
              <div>
                <h2>Assign Onboarding Task</h2>
                <p>Create a checklist task for an employee.</p>
              </div>
            </div>

            <form className="onboarding-form" onSubmit={handleAssignTask}>
              <div className="onboarding-field">
                <label htmlFor="onboarding-employee">Employee</label>
                <select
                  id="onboarding-employee"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.username || employee.email} — {employee.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="onboarding-field">
                <label htmlFor="onboarding-task">Task Name</label>
                <input
                  id="onboarding-task"
                  type="text"
                  minLength="3"
                  maxLength="200"
                  placeholder="e.g. Submit identity documents"
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  required
                />
              </div>

              <div className="onboarding-field">
                <label htmlFor="onboarding-due-date">
                  Due Date (Optional)
                </label>
                <input
                  id="onboarding-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>

              <button
                type="submit"
                className="onboarding-primary-button"
                disabled={submitting || employees.length === 0}
              >
                {submitting ? "Assigning..." : "Assign Task"}
              </button>
            </form>

            {employees.length === 0 && (
              <p className="onboarding-empty-note">
                No employees are available to assign tasks.
              </p>
            )}
          </section>

          <section className="onboarding-panel">
            <div className="onboarding-section-heading onboarding-list-heading">
              <div>
                <h2>Employee Onboarding Tasks</h2>
                <p>View the tasks assigned to employees.</p>
              </div>

              <select
                className="onboarding-filter"
                value={filterEmployee}
                onChange={(event) => setFilterEmployee(event.target.value)}
                aria-label="Filter tasks by employee"
              >
                <option value="ALL">All Employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.username || employee.email}
                  </option>
                ))}
              </select>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="onboarding-empty">
                No onboarding tasks found.
              </div>
            ) : (
              <div className="onboarding-table-wrapper">
                <table className="onboarding-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Employee ID</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.task_name}</td>
                        <td>{task.employee_id}</td>
                        <td>{formatDate(task.due_date)}</td>
                        <td>
                          <span
                            className={`onboarding-status ${
                              String(task.status).toUpperCase() === "COMPLETED"
                                ? "status-completed"
                                : "status-pending"
                            }`}
                          >
                            {task.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="onboarding-panel">
            <div className="onboarding-section-heading">
              <div>
                <h2>Progress by Employee</h2>
                <p>
                  Progress is calculated from the loaded onboarding tasks.
                </p>
              </div>
            </div>

            {managerProgress.length === 0 ? (
              <div className="onboarding-empty">
                Progress will appear after tasks are assigned.
              </div>
            ) : (
              <div className="onboarding-employee-progress-list">
                {managerProgress.map((item) => (
                  <div className="onboarding-employee-progress" key={item.id}>
                    <div className="onboarding-employee-progress-top">
                      <strong>{item.name}</strong>
                      <span>
                        {item.completed}/{item.total} completed ·{" "}
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="onboarding-progress-track">
                      <div
                        className="onboarding-progress-fill"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="onboarding-panel">
          <div className="onboarding-section-heading">
            <div>
              <h2>My Onboarding Checklist</h2>
              <p>Complete each task assigned to you.</p>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="onboarding-empty">
              You don't have any onboarding tasks assigned yet.
            </div>
          ) : (
            <div className="onboarding-checklist">
              {tasks.map((task) => {
                const isCompleted =
                  String(task.status).toUpperCase() === "COMPLETED";

                return (
                  <div
                    className={`onboarding-task-item ${
                      isCompleted ? "task-is-completed" : ""
                    }`}
                    key={task.id}
                  >
                    <div className="onboarding-task-details">
                      <span className="onboarding-task-icon">
                        {isCompleted ? "✓" : "○"}
                      </span>
                      <div>
                        <h3>{task.task_name}</h3>
                        <p>Due date: {formatDate(task.due_date)}</p>
                      </div>
                    </div>

                    {isCompleted ? (
                      <span className="onboarding-status status-completed">
                        Completed
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="onboarding-complete-button"
                        onClick={() => handleCompleteTask(task.id)}
                        disabled={completingId === task.id}
                      >
                        {completingId === task.id
                          ? "Updating..."
                          : "Mark Complete"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Onboarding;
