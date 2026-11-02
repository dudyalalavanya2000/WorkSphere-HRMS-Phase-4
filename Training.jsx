import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Training.css";

const API_BASE = "http://127.0.0.1:8000/api/v1/training";

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Technical",
  trainer: "",
  start_date: "",
  end_date: "",
  capacity: "30",
  status: "ACTIVE",
};

const ENROLLMENT_STATUSES = [
  "ENROLLED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return error?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "Not available";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`training-status status-${status?.toLowerCase()}`}>
      {(status || "UNKNOWN").replaceAll("_", " ")}
    </span>
  );
}

export default function Training() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();
  const isManager = role === "HR" || role === "ADMIN";

  const [programs, setPrograms] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const api = useCallback(
    (method, path, data) =>
      axios({
        method,
        url: `${API_BASE}${path}`,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    [token]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const requests = [
        api(
          "get",
          `/programs${isManager && includeInactive ? "?include_inactive=true" : ""}`
        ),
        api("get", "/enrollments/me"),
      ];

      if (isManager) {
        requests.push(api("get", "/enrollments"));
      }

      const results = await Promise.all(requests);

      setPrograms(results[0].data);
      setMyEnrollments(results[1].data);
      setAllEnrollments(isManager ? results[2].data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api, isManager, includeInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingProgramId(null);
  }

  async function handleProgramSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      ...form,
      capacity: Number(form.capacity),
    };

    try {
      if (editingProgramId) {
        await api("patch", `/programs/${editingProgramId}`, payload);
        setMessage("Training program updated successfully.");
      } else {
        await api("post", "/programs", payload);
        setMessage("Training program created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(program) {
    setEditingProgramId(program.id);
    setForm({
      title: program.title,
      description: program.description,
      category: program.category,
      trainer: program.trainer,
      start_date: program.start_date,
      end_date: program.end_date,
      capacity: String(program.capacity),
      status: program.status,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deactivateProgram(program) {
    if (
      !window.confirm(
        `Deactivate "${program.title}"? Existing enrollment history will be preserved.`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api("delete", `/programs/${program.id}`);
      setMessage("Training program deactivated successfully.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function enroll(program) {
    setError("");
    setMessage("");

    try {
      await api("post", `/programs/${program.id}/enroll`);
      setMessage(`Successfully enrolled in ${program.title}.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateEnrollment(enrollmentId, newStatus) {
    setError("");
    setMessage("");

    try {
      await api("patch", `/enrollments/${enrollmentId}`, {
        status: newStatus,
      });
      setMessage("Enrollment progress updated successfully.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function getMyEnrollment(programId) {
    return myEnrollments.find(
      (enrollment) => enrollment.program_id === programId
    );
  }

  if (!token) {
    return (
      <main className="training-page">
        <button
          type="button"
          className="training-button training-button-secondary training-back-button"
          onClick={() => navigate("/")}
        >
          ← Back to Login
        </button>

        <div className="training-alert training-alert-error">
          Please log in to access Training &amp; Development.
        </div>
      </main>
    );
  }

  return (
    <main className="training-page">
      <button
        type="button"
        className="training-button training-button-secondary training-back-button"
        onClick={() => navigate("/dashboard")}
      >
        ← Back to Dashboard
      </button>

      <header className="training-header">
        <div>
          <p className="training-eyebrow">WORKSPHERE HRMS · MODULE 18</p>
          <h1>Training &amp; Development</h1>
          <p className="training-subtitle">
            Discover training programs, build skills, and track learning progress.
          </p>
        </div>

        <button
          type="button"
          className="training-button training-button-secondary"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="training-alert training-alert-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="training-alert training-alert-success" role="status">
          {message}
        </div>
      )}

      {isManager && (
        <section className="training-panel">
          <div className="training-section-heading">
            <div>
              <h2>
                {editingProgramId ? "Edit Training Program" : "Create Training Program"}
              </h2>
              <p>Manage courses and employee learning opportunities.</p>
            </div>
          </div>

          <form className="training-form" onSubmit={handleProgramSubmit}>
            <label>
              Program Title
              <input
                name="title"
                value={form.title}
                onChange={handleFormChange}
                minLength={2}
                maxLength={150}
                required
                placeholder="e.g. Python Advanced Training"
              />
            </label>

            <label>
              Category
              <input
                name="category"
                value={form.category}
                onChange={handleFormChange}
                minLength={2}
                maxLength={100}
                required
                placeholder="Technical, Leadership, Compliance..."
              />
            </label>

            <label>
              Trainer
              <input
                name="trainer"
                value={form.trainer}
                onChange={handleFormChange}
                minLength={2}
                maxLength={150}
                required
                placeholder="Trainer name"
              />
            </label>

            <label>
              Capacity
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleFormChange}
                min="1"
                required
              />
            </label>

            <label>
              Start Date
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleFormChange}
                min={form.start_date || undefined}
                required
              />
            </label>

            <label>
              Program Status
              <select
                name="status"
                value={form.status}
                onChange={handleFormChange}
                required
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>

            <label className="training-full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                minLength={1}
                maxLength={2000}
                rows={3}
                required
                placeholder="Describe the learning objectives and content."
              />
            </label>

            <div className="training-form-actions training-full-width">
              <button
                type="submit"
                className="training-button training-button-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingProgramId
                    ? "Save Changes"
                    : "Create Program"}
              </button>

              {editingProgramId && (
                <button
                  type="button"
                  className="training-button training-button-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="training-section">
        <div className="training-section-heading">
          <div>
            <h2>Available Training Programs</h2>
            <p>
              {isManager
                ? "Review programs and manage their details."
                : "Choose a program to start learning."}
            </p>
          </div>

          {isManager && (
            <label className="training-checkbox">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Include inactive programs
            </label>
          )}
        </div>

        {loading ? (
          <p className="training-empty">Loading training programs...</p>
        ) : programs.length === 0 ? (
          <p className="training-empty">No training programs found.</p>
        ) : (
          <div className="training-program-grid">
            {programs.map((program) => {
              const enrollment = getMyEnrollment(program.id);
              const isEnrolled =
                enrollment && enrollment.status !== "CANCELLED";

              return (
                <article className="training-program-card" key={program.id}>
                  <div className="training-card-top">
                    <span className="training-category">{program.category}</span>
                    <StatusBadge status={program.status} />
                  </div>

                  <h3>{program.title}</h3>
                  <p className="training-description">{program.description}</p>

                  <div className="training-details">
                    <p><strong>Trainer:</strong> {program.trainer}</p>
                    <p><strong>Start:</strong> {formatDate(program.start_date)}</p>
                    <p><strong>End:</strong> {formatDate(program.end_date)}</p>
                    <p>
                      <strong>Seats:</strong> {program.available_seats} of{" "}
                      {program.capacity} available
                    </p>
                  </div>

                  {enrollment && (
                    <p className="training-enrollment-info">
                      Your status: <StatusBadge status={enrollment.status} />
                    </p>
                  )}

                  <div className="training-card-actions">
                    {!isManager && program.status === "ACTIVE" && (
                      <button
                        type="button"
                        className="training-button training-button-primary"
                        onClick={() => enroll(program)}
                        disabled={
                          Boolean(isEnrolled) || program.available_seats <= 0
                        }
                      >
                        {isEnrolled
                          ? "Already Enrolled"
                          : program.available_seats <= 0
                            ? "Fully Booked"
                            : "Enroll Now"}
                      </button>
                    )}

                    {isManager && (
                      <>
                        <button
                          type="button"
                          className="training-button training-button-secondary"
                          onClick={() => startEditing(program)}
                        >
                          Edit
                        </button>

                        {program.status === "ACTIVE" && (
                          <button
                            type="button"
                            className="training-button training-button-danger"
                            onClick={() => deactivateProgram(program)}
                          >
                            Deactivate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="training-section">
        <div className="training-section-heading">
          <div>
            <h2>{isManager ? "Employee Enrollments" : "My Training History"}</h2>
            <p>
              {isManager
                ? "Review and update employee training progress."
                : "Track your enrolled programs and completion status."}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="training-empty">Loading enrollment history...</p>
        ) : isManager ? (
          allEnrollments.length === 0 ? (
            <p className="training-empty">No employee enrollments yet.</p>
          ) : (
            <div className="training-table-wrapper">
              <table className="training-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Training Program</th>
                    <th>Enrollment Date</th>
                    <th>Progress</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allEnrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td>
                        {enrollment.employee_username || `User ${enrollment.employee_id}`}
                        <small>ID: {enrollment.employee_id}</small>
                      </td>
                      <td>
                        {enrollment.program_title || `Program ${enrollment.program_id}`}
                      </td>
                      <td>{formatDateTime(enrollment.enrolled_at)}</td>
                      <td>
                        <StatusBadge status={enrollment.status} />
                        {enrollment.completed_at && (
                          <small>
                            Completed: {formatDateTime(enrollment.completed_at)}
                          </small>
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`Update enrollment ${enrollment.id} status`}
                          value={enrollment.status}
                          onChange={(event) =>
                            updateEnrollment(enrollment.id, event.target.value)
                          }
                        >
                          {ENROLLMENT_STATUSES.map((item) => (
                            <option value={item} key={item}>
                              {item.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : myEnrollments.length === 0 ? (
          <p className="training-empty">
            You haven't enrolled in any training programs yet.
          </p>
        ) : (
          <div className="training-program-grid">
            {myEnrollments.map((enrollment) => (
              <article className="training-program-card" key={enrollment.id}>
                <div className="training-card-top">
                  <span className="training-category">
                    {enrollment.program?.category || "Training"}
                  </span>
                  <StatusBadge status={enrollment.status} />
                </div>

                <h3>
                  {enrollment.program?.title ||
                    `Training Program ${enrollment.program_id}`}
                </h3>

                {enrollment.program && (
                  <>
                    <p className="training-description">
                      {enrollment.program.description}
                    </p>
                    <div className="training-details">
                      <p><strong>Trainer:</strong> {enrollment.program.trainer}</p>
                      <p>
                        <strong>Dates:</strong>{" "}
                        {formatDate(enrollment.program.start_date)} –{" "}
                        {formatDate(enrollment.program.end_date)}
                      </p>
                    </div>
                  </>
                )}

                <div className="training-details">
                  <p>
                    <strong>Enrolled:</strong>{" "}
                    {formatDateTime(enrollment.enrolled_at)}
                  </p>
                  {enrollment.completed_at && (
                    <p>
                      <strong>Completed:</strong>{" "}
                      {formatDateTime(enrollment.completed_at)}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}