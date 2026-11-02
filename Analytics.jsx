
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const styles = {
  page: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "28px 20px",
    color: "#1e293b",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  button: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    padding: "10px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#334155",
    cursor: "pointer",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "11px 0",
    borderBottom: "1px solid #e2e8f0",
  },
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount ?? 0));
}

function StatCard({ title, value, description }) {
  return (
    <div style={styles.card}>
      <p style={{ color: "#64748b", margin: "0 0 10px", fontSize: "14px" }}>
        {title}
      </p>
      <h2 style={{ fontSize: "28px", margin: "0 0 8px", color: "#0f172a" }}>
        {value}
      </h2>
      {description && (
        <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>
          {description}
        </p>
      )}
    </div>
  );
}

function SummaryCard({ title, data }) {
  const entries = Object.entries(data ?? {});

  return (
    <section style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: "12px" }}>{title}</h3>

      {entries.length === 0 ? (
        <p style={{ color: "#64748b" }}>No data available.</p>
      ) : (
        entries.map(([label, value]) => (
          <div key={label} style={styles.row}>
            <span>{label.replaceAll("_", " ")}</span>
            <strong>{value ?? 0}</strong>
          </div>
        ))
      )}
    </section>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!token) {
      navigate("/");
      return;
    }

    if (!["HR", "ADMIN"].includes(role?.toUpperCase())) {
      navigate("/dashboard");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_URL}/api/v1/dashboard/analytics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAnalytics(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return;
      }

      if (err.response?.status === 403) {
        setError("You do not have permission to view HR analytics.");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load analytics. Please check the backend server."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const employees = analytics?.employees ?? {};
  const attendance = analytics?.attendance ?? {};
  const leaves = analytics?.leaves ?? {};
  const payroll = analytics?.payroll ?? {};

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "30px" }}>
            HR Analytics
          </h1>
          <p style={{ margin: 0, color: "#64748b" }}>
            WorkSphere workforce, attendance, leave and payroll overview.
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
            onClick={loadAnalytics}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Analytics"}
          </button>
        </div>
      </div>

      {loading && !analytics && (
        <p role="status">Loading analytics...</p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "14px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          {error}
          <button
            type="button"
            style={{ ...styles.secondaryButton, marginLeft: "12px" }}
            onClick={loadAnalytics}
          >
            Try Again
          </button>
        </div>
      )}

      {analytics && (
        <>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            Attendance date: {attendance.date ?? "—"}
            {" · "}
            Last generated:{" "}
            {analytics.generated_at
              ? new Date(analytics.generated_at).toLocaleString()
              : "—"}
          </p>

          <div style={styles.grid}>
            <StatCard
              title="Total User Accounts"
              value={employees.total_users ?? 0}
              description="Includes all account roles"
            />
            <StatCard
              title="Active Employees"
              value={employees.active_employees ?? 0}
              description="Active employee profiles"
            />
            <StatCard
              title="Present Today"
              value={attendance.present_today ?? 0}
              description="Attendance marked present"
            />
            <StatCard
              title="Pending Leaves"
              value={leaves.PENDING ?? 0}
              description="Awaiting HR review"
            />
            <StatCard
              title="Pending Payroll"
              value={payroll.pending_payments ?? 0}
              description="Payroll records awaiting payment"
            />
            <StatCard
              title="Total Salary Paid"
              value={formatCurrency(payroll.total_paid_salary)}
              description={`${payroll.paid_records ?? 0} paid payroll records`}
            />
          </div>

          <div style={styles.sectionGrid}>
            <SummaryCard
              title="Users by Role"
              data={employees.users_by_role}
            />

            <SummaryCard
              title="Employees by Department"
              data={employees.employees_by_department}
            />

            <SummaryCard
              title="Today's Attendance"
              data={{
                date: attendance.date ?? "—",
                present_today: attendance.present_today ?? 0,
                checked_out_today: attendance.checked_out_today ?? 0,
              }}
            />

            <SummaryCard title="Leave Summary" data={leaves} />

            <SummaryCard
              title="Payroll Summary"
              data={{
                total_records: payroll.total_records ?? 0,
                pending_payments: payroll.pending_payments ?? 0,
                paid_records: payroll.paid_records ?? 0,
                total_paid_salary: formatCurrency(
                  payroll.total_paid_salary
                ),
              }}
            />
          </div>
        </>
      )}
    </main>
  );
}
