
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily: "inherit",
  },
  header: {
    background: "#ffffff",
    borderBottom: "1px solid #e5eaf2",
    padding: "18px 5%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  content: {
    maxWidth: 1250,
    margin: "0 auto",
    padding: "32px 24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5eaf2",
    borderRadius: 14,
    padding: 22,
    marginBottom: 24,
    boxShadow: "0 3px 12px rgba(20, 35, 70, 0.03)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #d6dce8",
    borderRadius: 8,
    fontSize: 14,
    marginTop: 6,
    background: "#ffffff",
    color: "#172033",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#46536a",
  },
  primaryButton: {
    background: "#4338ca",
    color: "#ffffff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#344054",
    border: "1px solid #d6dce8",
    borderRadius: 8,
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 600,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    minWidth: 900,
  },
  th: {
    background: "#f7f8fc",
    color: "#667085",
    fontWeight: 600,
    textAlign: "left",
    padding: "13px 12px",
    borderBottom: "1px solid #e5eaf2",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #edf0f5",
    whiteSpace: "nowrap",
  },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }) {
  const paid = String(status || "").toUpperCase() === "PAID";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: paid ? "#dcfce7" : "#fff3d6",
        color: paid ? "#166534" : "#92400e",
      }}
    >
      {paid ? "PAID" : "PENDING"}
    </span>
  );
}

function SummaryCard({ label, value, detail, accent }) {
  return (
    <div style={{ ...styles.card, marginBottom: 0 }}>
      <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          marginTop: 10,
          color: accent || "#172033",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
      {detail && (
        <div style={{ color: "#667085", fontSize: 12, marginTop: 7 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

export default function Payroll() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const username = localStorage.getItem("username") || "User";
  const role = (
    localStorage.getItem("user_role") || "EMPLOYEE"
  ).toUpperCase();

  const isHR = role === "HR" || role === "ADMIN";

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [payslipLoadingId, setPayslipLoadingId] = useState(null);
  const [payslip, setPayslip] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    user_id: "",
    salary_month: currentMonth,
    basic_salary: "",
    allowances: "0",
    deductions: "0",
  });

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  }, [navigate]);

  const requestConfig = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  const loadPayroll = useCallback(async () => {
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = {};

      if (selectedMonth) {
        params.salary_month = selectedMonth;
      }

      if (isHR && selectedStatus) {
        params.payment_status = selectedStatus;
      }

      const payrollEndpoint = isHR
        ? `${API_URL}/api/v1/payroll/`
        : `${API_URL}/api/v1/payroll/me`;

      const requests = [
        axios.get(payrollEndpoint, {
          ...requestConfig,
          ...(isHR ? { params } : {}),
        }),
        axios.get(
          isHR
            ? `${API_URL}/api/v1/payroll/summary`
            : `${API_URL}/api/v1/payroll/me/summary`,
          {
            ...requestConfig,
            params: selectedMonth
              ? { salary_month: selectedMonth }
              : {},
          }
        ),
      ];

      const [payrollResponse, summaryResponse] =
        await Promise.all(requests);

      setRecords(
        Array.isArray(payrollResponse.data) ? payrollResponse.data : []
      );
      setSummary(summaryResponse.data || null);
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Could not load payroll information. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [
    token,
    navigate,
    requestConfig,
    isHR,
    selectedMonth,
    selectedStatus,
    handleUnauthorized,
  ]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleCreatePayroll(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const userId = Number(form.user_id);
    const basicSalary = Number(form.basic_salary);
    const allowances = Number(form.allowances);
    const deductions = Number(form.deductions);

    if (!Number.isInteger(userId) || userId < 1) {
      setError("Enter a valid employee user ID.");
      return;
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.salary_month)) {
      setError("Select a valid salary month.");
      return;
    }

    if (
      !Number.isFinite(basicSalary) ||
      !Number.isFinite(allowances) ||
      !Number.isFinite(deductions) ||
      basicSalary < 0 ||
      allowances < 0 ||
      deductions < 0
    ) {
      setError("Enter valid, non-negative salary amounts.");
      return;
    }

    if (basicSalary + allowances < deductions) {
      setError("Deductions cannot exceed basic salary plus allowances.");
      return;
    }

    setSaving(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/payroll/`,
        {
          user_id: userId,
          salary_month: form.salary_month,
          basic_salary: basicSalary,
          allowances,
          deductions,
        },
        {
          ...requestConfig,
          headers: {
            ...requestConfig.headers,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage("Payroll record created successfully.");

      setForm((previous) => ({
        ...previous,
        user_id: "",
        basic_salary: "",
        allowances: "0",
        deductions: "0",
      }));

      await loadPayroll();
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Could not create the payroll record."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(record) {
    if (String(record.payment_status).toUpperCase() === "PAID") {
      return;
    }

    const confirmed = window.confirm(
      `Mark the salary for ${
        record.username || `employee #${record.user_id}`
      } (${record.salary_month}) as PAID?`
    );

    if (!confirmed) return;

    setProcessingId(record.id);
    setError("");
    setMessage("");

    try {
      await axios.patch(
        `${API_URL}/api/v1/payroll/${record.id}/payment`,
        { payment_status: "PAID" },
        {
          ...requestConfig,
          headers: {
            ...requestConfig.headers,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage(`Payroll record #${record.id} marked as paid.`);
      await loadPayroll();
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Could not update the payroll payment status."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleViewPayslip(record) {
    setError("");
    setMessage("");
    setPayslipLoadingId(record.id);

    try {
      const endpoint = isHR
        ? `${API_URL}/api/v1/payroll/${record.id}/payslip`
        : `${API_URL}/api/v1/payroll/me/${record.id}/payslip`;

      const response = await axios.get(endpoint, requestConfig);
      setPayslip(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        err.response?.data?.detail || "Could not load the payslip."
      );
    } finally {
      setPayslipLoadingId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  }

  const visibleRecords = records;

  const totalRecords = summary?.payroll_count ?? visibleRecords.length;

  const totalBasic = summary?.total_basic_salary ??
    visibleRecords.reduce(
      (total, item) => total + Number(item.basic_salary || 0),
      0
    );

  const totalAllowances = summary?.total_allowances ??
    visibleRecords.reduce(
      (total, item) => total + Number(item.allowances || 0),
      0
    );

  const totalGross = summary?.total_gross_salary ??
    visibleRecords.reduce(
      (total, item) =>
        total +
        Number(item.basic_salary || 0) +
        Number(item.allowances || 0),
      0
    );

  const totalDeductions = summary?.total_deductions ??
    visibleRecords.reduce(
      (total, item) => total + Number(item.deductions || 0),
      0
    );

  const totalNet = summary?.total_net_salary ??
    visibleRecords.reduce(
      (total, item) => total + Number(item.net_salary || 0),
      0
    );

  const paidCount = summary?.paid_count ??
    visibleRecords.filter(
      (item) => String(item.payment_status).toUpperCase() === "PAID"
    ).length;

  const pendingCount = summary?.pending_count ??
    visibleRecords.filter(
      (item) => String(item.payment_status).toUpperCase() === "PENDING"
    ).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>WorkSphere</div>
          <div style={{ color: "#667085", fontSize: 12 }}>
            Payroll Management
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "#475467" }}>
            {username} · {role}
          </span>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <p
          style={{
            color: "#4338ca",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1.2,
            marginBottom: 8,
          }}
        >
          SALARY AND COMPENSATION
        </p>

        <h1 style={{ margin: "0 0 8px", fontSize: 30 }}>
          Payroll Management
        </h1>

        <p style={{ color: "#667085", marginTop: 0, marginBottom: 26 }}>
          {isHR
            ? "Create payroll records, review salary summaries, and manage payments."
            : "Review your salary breakdown, payment status, and payslips."}
        </p>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: 13,
              borderRadius: 9,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              background: "#ecfdf3",
              border: "1px solid #abefc6",
              color: "#067647",
              padding: 13,
              borderRadius: 9,
              marginBottom: 18,
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <SummaryCard
            label={isHR ? "Payroll records" : "My payroll records"}
            value={totalRecords}
            detail={selectedMonth || "All available months"}
          />

          <SummaryCard
            label="Total gross salary"
            value={formatCurrency(totalGross)}
            detail="Basic salary + allowances"
          />

          <SummaryCard
            label="Total deductions"
            value={formatCurrency(totalDeductions)}
            detail="Across selected records"
            accent="#b45309"
          />

          <SummaryCard
            label="Total net salary"
            value={formatCurrency(totalNet)}
            detail="After deductions"
            accent="#4338ca"
          />

          <SummaryCard
            label="Paid records"
            value={paidCount}
            detail="Payment completed"
            accent="#15803d"
          />

          <SummaryCard
            label="Pending records"
            value={pendingCount}
            detail="Awaiting payment"
            accent="#b45309"
          />
        </section>

        <section style={styles.card}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>
            Payroll filters
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16,
              alignItems: "end",
            }}
          >
            <label style={styles.label}>
              Salary month
              <input
                style={styles.input}
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>

            {isHR && (
              <label style={styles.label}>
                Payment status
                <select
                  style={styles.input}
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                </select>
              </label>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={loadPayroll}
                disabled={loading}
              >
                {loading ? "Loading..." : "Apply filters"}
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setSelectedMonth("");
                  setSelectedStatus("");
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        </section>

        {isHR && (
          <section style={styles.card}>
            <h2 style={{ fontSize: 19, marginTop: 0 }}>
              Create payroll record
            </h2>

            <p style={{ color: "#667085", fontSize: 13 }}>
              Enter the employee's user ID and salary details. New payroll
              records start with PENDING payment status.
            </p>

            <form onSubmit={handleCreatePayroll}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 16,
                }}
              >
                <label style={styles.label}>
                  Employee user ID
                  <input
                    style={styles.input}
                    type="number"
                    name="user_id"
                    min="1"
                    step="1"
                    value={form.user_id}
                    onChange={handleFormChange}
                    placeholder="e.g. 1"
                    required
                  />
                </label>

                <label style={styles.label}>
                  Salary month
                  <input
                    style={styles.input}
                    type="month"
                    name="salary_month"
                    value={form.salary_month}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label style={styles.label}>
                  Basic salary (₹)
                  <input
                    style={styles.input}
                    type="number"
                    name="basic_salary"
                    min="0"
                    step="1"
                    value={form.basic_salary}
                    onChange={handleFormChange}
                    placeholder="30000"
                    required
                  />
                </label>

                <label style={styles.label}>
                  Allowances (₹)
                  <input
                    style={styles.input}
                    type="number"
                    name="allowances"
                    min="0"
                    step="1"
                    value={form.allowances}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label style={styles.label}>
                  Deductions (₹)
                  <input
                    style={styles.input}
                    type="number"
                    name="deductions"
                    min="0"
                    step="1"
                    value={form.deductions}
                    onChange={handleFormChange}
                    required
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  style={{
                    ...styles.primaryButton,
                    opacity: saving ? 0.7 : 1,
                  }}
                  disabled={saving}
                >
                  {saving ? "Creating..." : "+ Create payroll"}
                </button>

                <span style={{ color: "#667085", fontSize: 12 }}>
                  Net salary is calculated by the backend.
                </span>
              </div>
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
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: 19, margin: "0 0 5px" }}>
                {isHR ? "All payroll records" : "My salary history"}
              </h2>
              <p style={{ color: "#667085", fontSize: 13, margin: 0 }}>
                Salary breakdown, payslips, and payment status.
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadPayroll}
              disabled={loading}
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {loading ? (
            <p>Loading payroll records...</p>
          ) : visibleRecords.length === 0 ? (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                color: "#667085",
              }}
            >
              No payroll records found for the selected filters.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Month</th>
                    {isHR && <th style={styles.th}>Employee</th>}
                    {isHR && <th style={styles.th}>Email</th>}
                    <th style={styles.th}>Basic salary</th>
                    <th style={styles.th}>Allowances</th>
                    <th style={styles.th}>Gross salary</th>
                    <th style={styles.th}>Deductions</th>
                    <th style={styles.th}>Net salary</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Paid at</th>
                    <th style={styles.th}>Payslip</th>
                    {isHR && <th style={styles.th}>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td style={styles.td}>
                        <strong>{record.salary_month}</strong>
                      </td>

                      {isHR && (
                        <td style={styles.td}>
                          {record.username || `User #${record.user_id}`}
                        </td>
                      )}

                      {isHR && (
                        <td style={styles.td}>{record.email || "—"}</td>
                      )}

                      <td style={styles.td}>
                        {formatCurrency(record.basic_salary)}
                      </td>

                      <td style={styles.td}>
                        {formatCurrency(record.allowances)}
                      </td>

                      <td style={styles.td}>
                        {formatCurrency(
                          Number(record.basic_salary || 0) +
                            Number(record.allowances || 0)
                        )}
                      </td>

                      <td style={styles.td}>
                        {formatCurrency(record.deductions)}
                      </td>

                      <td style={styles.td}>
                        <strong>{formatCurrency(record.net_salary)}</strong>
                      </td>

                      <td style={styles.td}>
                        <StatusBadge status={record.payment_status} />
                      </td>

                      <td style={styles.td}>
                        {formatDate(record.paid_at)}
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() => handleViewPayslip(record)}
                          disabled={payslipLoadingId === record.id}
                        >
                          {payslipLoadingId === record.id
                            ? "Loading..."
                            : "View payslip"}
                        </button>
                      </td>

                      {isHR && (
                        <td style={styles.td}>
                          {String(record.payment_status).toUpperCase() ===
                          "PAID" ? (
                            <span
                              style={{
                                color: "#15803d",
                                fontWeight: 600,
                              }}
                            >
                              Completed
                            </span>
                          ) : (
                            <button
                              type="button"
                              style={styles.primaryButton}
                              onClick={() => handleMarkPaid(record)}
                              disabled={processingId === record.id}
                            >
                              {processingId === record.id
                                ? "Updating..."
                                : "Mark as paid"}
                            </button>
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

        {payslip && (
          <section style={styles.card} aria-live="polite">
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
                <h2 style={{ fontSize: 21, margin: "0 0 5px" }}>
                  Payslip
                </h2>
                <p style={{ color: "#667085", margin: 0, fontSize: 13 }}>
                  Salary month: {payslip.salary_month}
                </p>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setPayslip(null)}
              >
                Close payslip
              </button>
            </div>

            <div
              style={{
                marginTop: 22,
                padding: 20,
                border: "1px solid #e5eaf2",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 18,
                  marginBottom: 24,
                }}
              >
                <div>
                  <div style={{ color: "#667085", fontSize: 12 }}>
                    Employee
                  </div>
                  <strong>{payslip.employee_name || username}</strong>
                </div>

                <div>
                  <div style={{ color: "#667085", fontSize: 12 }}>
                    Email
                  </div>
                  <strong>{payslip.employee_email || "—"}</strong>
                </div>

                <div>
                  <div style={{ color: "#667085", fontSize: 12 }}>
                    Payroll ID
                  </div>
                  <strong>{payslip.payroll_id}</strong>
                </div>

                <div>
                  <div style={{ color: "#667085", fontSize: 12 }}>
                    Payment status
                  </div>
                  <StatusBadge status={payslip.payment_status} />
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={{ ...styles.table, minWidth: 0 }}>
                  <tbody>
                    <tr>
                      <td style={styles.td}>Basic salary</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {formatCurrency(payslip.basic_salary)}
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.td}>Allowances</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {formatCurrency(payslip.allowances)}
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.td}>
                        <strong>Gross salary</strong>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <strong>
                          {formatCurrency(payslip.gross_salary)}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.td}>Deductions</td>
                      <td
                        style={{
                          ...styles.td,
                          textAlign: "right",
                          color: "#b45309",
                        }}
                      >
                        {formatCurrency(payslip.deductions)}
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.td}>
                        <strong>Net salary</strong>
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          textAlign: "right",
                          fontSize: 17,
                          fontWeight: 800,
                          color: "#4338ca",
                        }}
                      >
                        {formatCurrency(payslip.net_salary)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 18,
                  marginTop: 20,
                  color: "#667085",
                  fontSize: 12,
                }}
              >
                <div>
                  Payment date: {formatDateTime(payslip.paid_at)}
                </div>
                <div>
                  Record created: {formatDateTime(payslip.created_at)}
                </div>
              </div>

              <div style={{ marginTop: 22 }}>
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={() => window.print()}
                >
                  Print payslip
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
