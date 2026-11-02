
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";
const ROLES = ["EMPLOYEE", "HR", "ADMIN"];

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#1e293b",
    padding: "28px 20px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "1150px",
    margin: "0 auto",
  },
  button: {
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "10px 14px",
    background: "#ffffff",
    color: "#1e293b",
    fontWeight: 600,
    cursor: "pointer",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "20px",
  },
  input: {
    padding: "9px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#1e293b",
    maxWidth: "100%",
  },
};

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || "Invalid input").join(", ");
  }

  return error.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export default function AdminManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [roleChanges, setRoleChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("access_token");
  const currentRole = (
    localStorage.getItem("user_role") || ""
  ).toUpperCase();
  const currentUsername = localStorage.getItem("username") || "";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  }, [navigate]);

  const loadUsers = useCallback(async () => {
    if (!token) {
      clearSession();
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.get(
        `${API_URL}/api/v1/admin/users`,
        { headers }
      );

      const userList = Array.isArray(response.data)
        ? response.data
        : [];

      setUsers(userList);
      setRoleChanges(
        Object.fromEntries(
          userList.map((user) => [user.id, user.role])
        )
      );
    } catch (err) {
      if (err.response?.status === 401) {
        clearSession();
      } else if (err.response?.status === 403) {
        setError("Access denied. Only ADMIN accounts can manage users.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [token, clearSession]);

  useEffect(() => {
    if (currentRole !== "ADMIN") {
      navigate("/dashboard", { replace: true });
      return;
    }

    loadUsers();
  }, [currentRole, loadUsers, navigate]);

  async function updateRole(user) {
    const newRole = roleChanges[user.id];

    if (!newRole || newRole === user.role) return;

    if (user.username === currentUsername && newRole !== "ADMIN") {
      setError("You cannot change your own ADMIN role.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${user.username}'s role from ${user.role} to ${newRole}?`
    );

    if (!confirmed) return;

    setSavingUserId(user.id);
    setError("");
    setSuccess("");

    try {
      const response = await axios.patch(
        `${API_URL}/api/v1/admin/users/${user.id}/role`,
        { role: newRole },
        { headers }
      );

      const updatedUser = response.data;

      setUsers((previous) =>
        previous.map((item) =>
          item.id === updatedUser.id ? updatedUser : item
        )
      );

      setRoleChanges((previous) => ({
        ...previous,
        [updatedUser.id]: updatedUser.role,
      }));

      setSuccess(
        `Role updated successfully for ${updatedUser.username}: ${updatedUser.role}.`
      );
    } catch (err) {
      if (err.response?.status === 401) {
        clearSession();
      } else {
        setError(getErrorMessage(err));
        await loadUsers();
      }
    } finally {
      setSavingUserId(null);
    }
  }

  const adminCount = users.filter(
    (user) => user.role === "ADMIN"
  ).length;

  if (currentRole !== "ADMIN") return null;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 8px", color: "#1d4ed8" }}>
              Admin Management
            </h1>
            <p style={{ color: "#64748b", margin: 0 }}>
              View registered accounts and manage user roles.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              style={styles.button}
              onClick={loadUsers}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginTop: "24px",
          }}
        >
          {[
            ["Total Accounts", users.length],
            ["Administrators", adminCount],
            ["Employees", users.filter((u) => u.role === "EMPLOYEE").length],
            ["HR Accounts", users.filter((u) => u.role === "HR").length],
          ].map(([label, value]) => (
            <div key={label} style={styles.panel}>
              <p style={{ color: "#64748b", margin: "0 0 8px" }}>
                {label}
              </p>
              <h2 style={{ margin: 0 }}>{value}</h2>
            </div>
          ))}
        </section>

        {error && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              background: "#fef2f2",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "18px",
            }}
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            style={{
              color: "#166534",
              background: "#f0fdf4",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "18px",
            }}
          >
            {success}
          </p>
        )}

        <section style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Registered Users</h2>
          <p style={{ color: "#64748b" }}>
            Role changes take effect for new login tokens. The current
            administrator cannot remove their own ADMIN role.
          </p>

          {loading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No users were returned by the API.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "760px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    {[
                      "ID",
                      "Username",
                      "Email",
                      "Current Role",
                      "Change Role",
                      "Created At",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        {user.id}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        {user.username}
                        {user.username === currentUsername && (
                          <div style={{ color: "#64748b", fontSize: "12px" }}>
                            You
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        {user.email}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        <strong>{user.role}</strong>
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        <select
                          aria-label={`Role for ${user.username}`}
                          value={roleChanges[user.id] || user.role}
                          onChange={(event) =>
                            setRoleChanges((previous) => ({
                              ...previous,
                              [user.id]: event.target.value,
                            }))
                          }
                          disabled={
                            savingUserId === user.id ||
                            user.username === currentUsername
                          }
                          style={styles.input}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        {formatDate(user.created_at)}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                        <button
                          type="button"
                          style={{
                            ...styles.button,
                            opacity:
                              savingUserId === user.id ||
                              roleChanges[user.id] === user.role
                                ? 0.6
                                : 1,
                            cursor:
                              savingUserId === user.id ||
                              roleChanges[user.id] === user.role
                                ? "not-allowed"
                                : "pointer",
                          }}
                          disabled={
                            savingUserId === user.id ||
                            roleChanges[user.id] === user.role
                          }
                          onClick={() => updateRole(user)}
                        >
                          {savingUserId === user.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
