
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const categories = [
  "TRAVEL",
  "FOOD",
  "ACCOMMODATION",
  "OFFICE_SUPPLIES",
  "INTERNET",
  "TRAINING",
  "OTHER",
];

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "14px",
  background: "#fff",
};

const primaryButton = {
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "9px 12px",
  background: "#fff",
  color: "#1e293b",
  fontWeight: 600,
  cursor: "pointer",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN");
}

function formatAmount(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function StatusBadge({ status }) {
  const colors = {
    PENDING: { background: "#fef3c7", color: "#92400e" },
    APPROVED: { background: "#dcfce7", color: "#166534" },
    REJECTED: { background: "#fee2e2", color: "#991b1b" },
    REIMBURSED: { background: "#dbeafe", color: "#1d4ed8" },
  };

  const style = colors[status] || {
    background: "#f1f5f9",
    color: "#334155",
  };

  return (
    <span
      style={{
        ...style,
        display: "inline-block",
        borderRadius: "999px",
        padding: "5px 10px",
        fontSize: "12px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

export default function Expenses() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();
  const username = localStorage.getItem("username") || "User";
  const isManager = role === "HR" || role === "ADMIN";

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [category, setCategory] = useState("TRAVEL");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [description, setDescription] = useState("");

  const [remarksById, setRemarksById] = useState({});

  const authConfig = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const loadClaims = useCallback(async () => {
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isManager
        ? `${API_URL}/api/v1/expenses/`
        : `${API_URL}/api/v1/expenses/me`;

      const response = await axios.get(endpoint, authConfig);
      setClaims(Array.isArray(response.data) ? response.data : []);
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
          "Unable to load expense claims. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token, isManager, navigate]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const numericAmount = Number(amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setError("Enter a positive amount in whole rupees.");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/expenses/`,
        {
          category,
          amount: numericAmount,
          expense_date: expenseDate,
          description: description.trim(),
        },
        authConfig
      );

      setAmount("");
      setDescription("");
      setCategory("TRAVEL");
      setExpenseDate(new Date().toLocaleDateString("en-CA"));
      setMessage("Expense claim submitted successfully.");
      await loadClaims();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not submit the expense claim."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewClaim(claimId, newStatus) {
    setError("");
    setMessage("");
    setBusyId(claimId);

    try {
      await axios.patch(
        `${API_URL}/api/v1/expenses/${claimId}/review`,
        {
          status: newStatus,
          review_remarks: remarksById[claimId]?.trim() || null,
        },
        authConfig
      );

      setMessage(`Expense #${claimId} marked ${newStatus}.`);
      await loadClaims();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update the expense claim."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reimburseClaim(claimId) {
    setError("");
    setMessage("");
    setBusyId(claimId);

    try {
      await axios.patch(
        `${API_URL}/api/v1/expenses/${claimId}/reimburse`,
        {},
        authConfig
      );

      setMessage(`Expense #${claimId} marked as reimbursed.`);
      await loadClaims();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to mark this claim as reimbursed."
      );
    } finally {
      setBusyId(null);
    }
  }

  const visibleClaims =
    statusFilter === "ALL"
      ? claims
      : claims.filter((claim) => claim.status === statusFilter);

  const totalAmount = visibleClaims.reduce(
    (sum, claim) => sum + Number(claim.amount || 0),
    0
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
        paddingBottom: "40px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          padding: "18px 5%",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            color: "#1d4ed8",
            fontSize: "22px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          WorkSphere
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span>
            {username} · <strong>{role}</strong>
          </span>
          <button
            type="button"
            style={secondaryButton}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "28px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 8px" }}>
              Expense & Reimbursement
            </h1>
            <p style={{ margin: 0, color: "#64748b" }}>
              {isManager
                ? "Review employee expense claims and track reimbursements."
                : "Submit your expense claims and track their status."}
            </p>
          </div>

          <button
            type="button"
            style={secondaryButton}
            onClick={loadClaims}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              marginTop: "20px",
              padding: "12px",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {typeof error === "string" ? error : "Something went wrong."}
          </p>
        )}

        {message && (
          <p
            role="status"
            style={{
              marginTop: "20px",
              padding: "12px",
              borderRadius: "8px",
              background: "#dcfce7",
              color: "#166534",
            }}
          >
            {message}
          </p>
        )}

        {!isManager && (
          <section
            style={{
              marginTop: "24px",
              padding: "22px",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              background: "#fff",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Submit an Expense Claim</h2>

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "16px",
                }}
              >
                <label>
                  <span style={{ display: "block", marginBottom: "7px" }}>
                    Category
                  </span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    style={inputStyle}
                    required
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={{ display: "block", marginBottom: "7px" }}>
                    Amount (₹)
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="10000000"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="e.g. 1250"
                    style={inputStyle}
                    required
                  />
                </label>

                <label>
                  <span style={{ display: "block", marginBottom: "7px" }}>
                    Expense date
                  </span>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    style={inputStyle}
                    required
                  />
                </label>
              </div>

              <label style={{ display: "block", marginTop: "16px" }}>
                <span style={{ display: "block", marginBottom: "7px" }}>
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  placeholder="Explain the expense and its business purpose"
                  style={{ ...inputStyle, resize: "vertical" }}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...primaryButton,
                  marginTop: "16px",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit Expense"}
              </button>
            </form>
          </section>
        )}

        <section
          style={{
            marginTop: "24px",
            padding: "22px",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px" }}>
                {isManager ? "All Expense Claims" : "My Expense Claims"}
              </h2>
              <p style={{ margin: 0, color: "#64748b" }}>
                {visibleClaims.length} claim(s) · Total shown:{" "}
                <strong>{formatAmount(totalAmount)}</strong>
              </p>
            </div>

            <select
              aria-label="Filter expense claims by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{ ...inputStyle, width: "190px" }}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="REIMBURSED">Reimbursed</option>
            </select>
          </div>

          {loading ? (
            <p>Loading expense claims...</p>
          ) : visibleClaims.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              No expense claims found for this filter.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: isManager ? "950px" : "700px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "Claim",
                      ...(isManager ? ["Employee ID"] : []),
                      "Category",
                      "Amount",
                      "Expense Date",
                      "Status",
                      "Details",
                      ...(isManager ? ["Actions"] : []),
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visibleClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td style={cellStyle}>#{claim.id}</td>

                      {isManager && (
                        <td style={cellStyle}>{claim.employee_id}</td>
                      )}

                      <td style={cellStyle}>
                        {claim.category?.replaceAll("_", " ")}
                      </td>

                      <td style={{ ...cellStyle, fontWeight: 700 }}>
                        {formatAmount(claim.amount)}
                      </td>

                      <td style={cellStyle}>
                        {formatDate(claim.expense_date)}
                      </td>

                      <td style={cellStyle}>
                        <StatusBadge status={claim.status} />
                      </td>

                      <td style={{ ...cellStyle, minWidth: "180px" }}>
                        <div>{claim.description}</div>
                        {claim.review_remarks && (
                          <p
                            style={{
                              color: "#64748b",
                              fontSize: "12px",
                              marginBottom: 0,
                            }}
                          >
                            Remarks: {claim.review_remarks}
                          </p>
                        )}
                      </td>

                      {isManager && (
                        <td style={{ ...cellStyle, minWidth: "240px" }}>
                          {claim.status === "PENDING" ? (
                            <div style={{ display: "grid", gap: "8px" }}>
                              <input
                                type="text"
                                value={remarksById[claim.id] || ""}
                                onChange={(event) =>
                                  setRemarksById((previous) => ({
                                    ...previous,
                                    [claim.id]: event.target.value,
                                  }))
                                }
                                placeholder="Review remarks (optional)"
                                style={inputStyle}
                              />

                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  disabled={busyId === claim.id}
                                  style={{
                                    ...primaryButton,
                                    background: "#15803d",
                                  }}
                                  onClick={() =>
                                    reviewClaim(claim.id, "APPROVED")
                                  }
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === claim.id}
                                  style={{
                                    ...primaryButton,
                                    background: "#b91c1c",
                                  }}
                                  onClick={() =>
                                    reviewClaim(claim.id, "REJECTED")
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ) : claim.status === "APPROVED" ? (
                            <button
                              type="button"
                              disabled={busyId === claim.id}
                              style={{
                                ...primaryButton,
                                background: "#15803d",
                              }}
                              onClick={() => reimburseClaim(claim.id)}
                            >
                              {busyId === claim.id
                                ? "Updating..."
                                : "Mark Reimbursed"}
                            </button>
                          ) : (
                            <span style={{ color: "#64748b" }}>
                              No action available
                            </span>
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
      </section>
    </main>
  );
}

const cellStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
  fontSize: "14px",
};
