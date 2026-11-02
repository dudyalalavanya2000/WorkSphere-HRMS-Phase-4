
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 5%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brand: { fontSize: 22, fontWeight: 800, color: "#4338ca" },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  button: {
    border: "none",
    borderRadius: 8,
    padding: "10px 15px",
    cursor: "pointer",
    fontWeight: 700,
  },
  primary: { background: "#4f46e5", color: "#ffffff" },
  secondary: { background: "#e8eafc", color: "#3730a3" },
  content: { maxWidth: 1200, margin: "0 auto", padding: "30px 5%" },
  eyebrow: {
    color: "#6366f1",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  heading: { fontSize: 30, margin: "8px 0" },
  description: { color: "#64748b", lineHeight: 1.6 },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 22,
    marginTop: 22,
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 13, fontWeight: 700, color: "#475569" },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#172033",
    fontSize: 14,
  },
  tableWrap: { overflowX: "auto", marginTop: 14 },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: 13,
  },
  th: {
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#64748b",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
  },
  muted: { color: "#64748b", fontSize: 13 },
  alert: {
    padding: 13,
    borderRadius: 8,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 1.5,
  },
};

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function statusStyle(status) {
  const colors = {
    PENDING: { background: "#fef3c7", color: "#92400e" },
    APPROVED: { background: "#dcfce7", color: "#166534" },
    REJECTED: { background: "#fee2e2", color: "#991b1b" },
  };
  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    ...colors[status],
  };
}

export default function LeaveManagement() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const username = localStorage.getItem("username") || "User";
  const role = (localStorage.getItem("user_role") || "EMPLOYEE").toUpperCase();
  const isReviewer = role === "HR" || role === "ADMIN";

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    leave_type: "ANNUAL",
    reason: "",
  });

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const loadRequests = useCallback(async () => {
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isReviewer
        ? "/api/v1/leaves/"
        : "/api/v1/leaves/me";

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load leave requests. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token, isReviewer, navigate]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, refreshKey]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleApply(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.start_date < todayString) {
      setError("Leave start date cannot be in the past.");
      return;
    }

    if (form.end_date < form.start_date) {
      setError("End date cannot be earlier than the start date.");
      return;
    }

    if (form.reason.trim().length < 3) {
      setError("Please enter a reason of at least 3 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/leaves/`,
        {
          start_date: form.start_date,
          end_date: form.end_date,
          leave_type: form.leave_type,
          reason: form.reason.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage("Leave request submitted successfully.");
      setForm({
        start_date: "",
        end_date: "",
        leave_type: "ANNUAL",
        reason: "",
      });
      setRefreshKey((key) => key + 1);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to submit your leave request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(leaveId, decision) {
    const action = decision === "APPROVED" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    setError("");
    setMessage("");
    setReviewingId(leaveId);

    try {
      await axios.patch(
        `${API_URL}/api/v1/leaves/${leaveId}/review`,
        { status: decision },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage(`Leave request #${leaveId} ${action}d successfully.`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.detail ||
          `Unable to ${action} this leave request.`
      );
    } finally {
      setReviewingId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/");
  }

  const pendingCount = requests.filter(
    (item) => item.status === "PENDING"
  ).length;
  const approvedCount = requests.filter(
    (item) => item.status === "APPROVED"
  ).length;
  const rejectedCount = requests.filter(
    (item) => item.status === "REJECTED"
  ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>WorkSphere</div>
        <div style={styles.headerRight}>
          <span style={{ fontSize: 13 }}>
            {username} · {role}
          </span>
          <button
            type="button"
            style={{ ...styles.button, ...styles.secondary }}
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.primary }}
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <div style={styles.eyebrow}>People Operations</div>
        <h1 style={styles.heading}>Leave Management</h1>
        <p style={styles.description}>
          {isReviewer
            ? "Review employee leave requests and manage approvals."
            : "Apply for leave and track the status of your requests."}
        </p>

        {error && (
          <div
            role="alert"
            style={{
              ...styles.alert,
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              ...styles.alert,
              background: "#dcfce7",
              color: "#166534",
            }}
          >
            {message}
          </div>
        )}

        {!isReviewer && (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>
              Apply for leave
            </h2>
            <p style={styles.muted}>
              Select your dates, leave type, and reason. Requests are submitted
              as pending until HR reviews them.
            </p>

            <form onSubmit={handleApply}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label} htmlFor="start_date">
                    Start date
                  </label>
                  <input
                    id="start_date"
                    style={styles.input}
                    type="date"
                    name="start_date"
                    min={todayString}
                    value={form.start_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label} htmlFor="end_date">
                    End date
                  </label>
                  <input
                    id="end_date"
                    style={styles.input}
                    type="date"
                    name="end_date"
                    min={form.start_date || todayString}
                    value={form.end_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label} htmlFor="leave_type">
                    Leave type
                  </label>
                  <select
                    id="leave_type"
                    style={styles.input}
                    name="leave_type"
                    value={form.leave_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="ANNUAL">Annual</option>
                    <option value="SICK">Sick</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </div>
              </div>

              <div style={{ ...styles.field, marginTop: 16 }}>
                <label style={styles.label} htmlFor="reason">
                  Reason
                </label>
                <textarea
                  id="reason"
                  style={{ ...styles.input, minHeight: 100, resize: "vertical" }}
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  minLength={3}
                  maxLength={500}
                  placeholder="Explain why you need leave..."
                  required
                />
                <span style={styles.muted}>
                  {form.reason.length}/500 characters
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...styles.button,
                  ...styles.primary,
                  marginTop: 18,
                  opacity: submitting ? 0.65 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit Leave Request"}
              </button>
            </form>
          </section>
        )}

        <section style={styles.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {isReviewer ? "Employee Leave Requests" : "My Leave History"}
              </h2>
              <p style={styles.muted}>
                {requests.length} request(s) · {pendingCount} pending ·{" "}
                {approvedCount} approved · {rejectedCount} rejected
              </p>
            </div>

            <button
              type="button"
              style={{ ...styles.button, ...styles.secondary }}
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <p style={styles.description}>Loading leave requests...</p>
          ) : requests.length === 0 ? (
            <p style={styles.description}>
              No leave requests found.
            </p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {isReviewer && <th style={styles.th}>Employee</th>}
                    <th style={styles.th}>Leave type</th>
                    <th style={styles.th}>Start date</th>
                    <th style={styles.th}>End date</th>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Submitted</th>
                    {isReviewer && <th style={styles.th}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id}>
                      {isReviewer && (
                        <td style={styles.td}>
                          <strong>{item.username}</strong>
                          <div style={styles.muted}>{item.email}</div>
                          <div style={styles.muted}>User ID: {item.user_id}</div>
                        </td>
                      )}
                      <td style={styles.td}>{item.leave_type}</td>
                      <td style={styles.td}>{formatDate(item.start_date)}</td>
                      <td style={styles.td}>{formatDate(item.end_date)}</td>
                      <td style={{ ...styles.td, minWidth: 150 }}>
                        {item.reason}
                      </td>
                      <td style={styles.td}>
                        <span style={statusStyle(item.status)}>
                          {item.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {formatDateTime(item.created_at)}
                      </td>
                      {isReviewer && (
                        <td style={styles.td}>
                          {item.status === "PENDING" ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                disabled={reviewingId === item.id}
                                style={{
                                  ...styles.button,
                                  background: "#dcfce7",
                                  color: "#166534",
                                  whiteSpace: "nowrap",
                                }}
                                onClick={() =>
                                  handleReview(item.id, "APPROVED")
                                }
                              >
                                {reviewingId === item.id
                                  ? "Saving..."
                                  : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={reviewingId === item.id}
                                style={{
                                  ...styles.button,
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                }}
                                onClick={() =>
                                  handleReview(item.id, "REJECTED")
                                }
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={styles.muted}>Reviewed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
