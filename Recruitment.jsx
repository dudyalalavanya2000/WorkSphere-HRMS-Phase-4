
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
];

const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];

const ONBOARDING_STATUSES = [
  "PENDING",
  "DOCUMENTS_PENDING",
  "IN_PROGRESS",
  "COMPLETED",
];

const initialJob = {
  title: "",
  description: "",
  department: "",
  location: "",
  employment_type: "FULL_TIME",
  salary_range: "",
  openings: 1,
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "14px",
    padding: "18px 6%",
    background: "#fff",
    borderBottom: "1px solid #e5eaf2",
  },
  brand: { fontSize: "22px", fontWeight: 800, color: "#192b45" },
  headerActions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" },
  panel: {
    marginTop: "22px",
    padding: "22px",
    background: "#fff",
    border: "1px solid #e5eaf2",
    borderRadius: "14px",
    boxShadow: "0 5px 18px rgba(20,35,65,0.04)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: "16px",
  },
  card: {
    padding: "18px",
    border: "1px solid #e5eaf2",
    borderRadius: "12px",
    background: "#fff",
    minWidth: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#172033",
    font: "inherit",
  },
  label: { display: "block", margin: "12px 0 6px", fontWeight: 600, fontSize: "14px" },
  button: {
    padding: "10px 14px",
    border: "1px solid #d7dfeb",
    borderRadius: "8px",
    background: "#fff",
    color: "#263b63",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 600,
  },
  primary: {
    padding: "10px 14px",
    border: "none",
    borderRadius: "8px",
    background: "#2457d6",
    color: "#fff",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
  },
  danger: {
    padding: "9px 12px",
    border: "none",
    borderRadius: "8px",
    background: "#b42318",
    color: "#fff",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 600,
  },
  muted: { color: "#64748b", lineHeight: 1.6 },
  tableWrap: { width: "100%", overflowX: "auto", marginTop: "14px" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" },
  cell: { padding: "12px", borderBottom: "1px solid #edf0f5", verticalAlign: "top" },
  badge: {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "20px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 700,
  },
};

function formatDate(value) {
  if (!value) return "—";
  const date = String(value).slice(0, 10).split("-");
  return date.length === 3 ? `${date[2]}-${date[1]}-${date[0]}` : value;
}

function displayError(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  }
  return fallback;
}

export default function Recruitment() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const username = localStorage.getItem("username") || "User";
  const role = (localStorage.getItem("user_role") || "EMPLOYEE").toUpperCase();
  const isManager = role === "HR" || role === "ADMIN";

  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [onboarding, setOnboarding] = useState([]);
  const [coverLetters, setCoverLetters] = useState({});
  const [newJob, setNewJob] = useState(initialJob);
  const [interviewDates, setInterviewDates] = useState({});
  const [onboardingEdits, setOnboardingEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const authConfig = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const clearNotices = () => {
    setError("");
    setMessage("");
  };

  const loadData = useCallback(async () => {
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const requests = [
        axios.get(`${API_URL}/api/v1/recruitment/jobs`, {
          ...authConfig,
          params: { include_closed: isManager },
        }),
        axios.get(
          `${API_URL}/api/v1/recruitment/${isManager ? "applications" : "applications/me"}`,
          authConfig
        ),
        axios.get(
          `${API_URL}/api/v1/recruitment/${isManager ? "onboarding" : "onboarding/me"}`,
          authConfig
        ),
      ];

      const [jobsResponse, applicationsResponse, onboardingResponse] =
        await Promise.all(requests);

      setJobs(Array.isArray(jobsResponse.data) ? jobsResponse.data : []);
      setApplications(
        Array.isArray(applicationsResponse.data) ? applicationsResponse.data : []
      );
      setOnboarding(
        Array.isArray(onboardingResponse.data) ? onboardingResponse.data : []
      );
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/", { replace: true });
        return;
      }

      setError(displayError(err, "Unable to load recruitment data."));
    } finally {
      setLoading(false);
    }
  }, [token, isManager, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function applyForJob(jobId) {
    clearNotices();
    setWorking(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/recruitment/jobs/${jobId}/apply`,
        { cover_letter: coverLetters[jobId] || "" },
        authConfig
      );
      setMessage("Your job application was submitted successfully.");
      setCoverLetters((current) => ({ ...current, [jobId]: "" }));
      await loadData();
    } catch (err) {
      setError(displayError(err, "Unable to submit your application."));
    } finally {
      setWorking(false);
    }
  }

  async function createJob(event) {
    event.preventDefault();
    clearNotices();
    setWorking(true);

    try {
      const payload = {
        ...newJob,
        title: newJob.title.trim(),
        description: newJob.description.trim(),
        department: newJob.department.trim(),
        location: newJob.location.trim(),
        salary_range: newJob.salary_range.trim() || null,
        openings: Number(newJob.openings),
      };

      await axios.post(
        `${API_URL}/api/v1/recruitment/jobs`,
        payload,
        authConfig
      );

      setMessage("Vacancy created successfully.");
      setNewJob(initialJob);
      await loadData();
    } catch (err) {
      setError(displayError(err, "Unable to create the vacancy."));
    } finally {
      setWorking(false);
    }
  }

  async function closeJob(jobId) {
    if (!window.confirm("Close this vacancy? It will not be permanently deleted.")) {
      return;
    }

    clearNotices();
    setWorking(true);

    try {
      await axios.delete(
        `${API_URL}/api/v1/recruitment/jobs/${jobId}`,
        authConfig
      );
      setMessage("Vacancy closed successfully.");
      await loadData();
    } catch (err) {
      setError(displayError(err, "Unable to close this vacancy."));
    } finally {
      setWorking(false);
    }
  }

  async function updateApplication(applicationId, nextStatus) {
    clearNotices();

    const payload = { status: nextStatus };
    const interviewDate = interviewDates[applicationId];

    if (nextStatus === "INTERVIEW") {
      if (!interviewDate) {
        setError("Choose an interview date and time before setting INTERVIEW status.");
        return;
      }
      payload.interview_date = new Date(interviewDate).toISOString();
    }

    setWorking(true);

    try {
      await axios.patch(
        `${API_URL}/api/v1/recruitment/applications/${applicationId}/status`,
        payload,
        authConfig
      );

      setMessage(
        nextStatus === "SELECTED"
          ? "Candidate selected. An onboarding record should now be available."
          : `Application status updated to ${nextStatus}.`
      );
      await loadData();
    } catch (err) {
      setError(displayError(err, "Unable to update the application."));
    } finally {
      setWorking(false);
    }
  }

  async function updateOnboarding(record) {
    clearNotices();
    const edits = onboardingEdits[record.id] || {};

    const payload = {
      status: edits.status || record.status,
      joining_date: edits.joining_date || record.joining_date || null,
      notes: edits.notes ?? record.notes ?? null,
    };

    setWorking(true);

    try {
      await axios.patch(
        `${API_URL}/api/v1/recruitment/onboarding/${record.id}`,
        payload,
        authConfig
      );
      setMessage(`Onboarding record #${record.id} updated successfully.`);
      await loadData();
    } catch (err) {
      setError(displayError(err, "Unable to update onboarding."));
    } finally {
      setWorking(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  }

  function updateJobField(field, value) {
    setNewJob((current) => ({ ...current, [field]: value }));
  }

  function updateOnboardingField(id, field, value) {
    setOnboardingEdits((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), [field]: value },
    }));
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>WorkSphere</div>
        <div style={styles.headerActions}>
          <span style={{ color: "#64748b", fontSize: "13px" }}>
            {username} · {role}
          </span>
          <button style={styles.button} onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </button>
          <button style={styles.button} onClick={logout}>Log out</button>
        </div>
      </header>

      <main style={styles.content}>
        <p style={{ ...styles.muted, marginBottom: 4 }}>TALENT ACQUISITION</p>
        <h1 style={{ margin: "6px 0" }}>Recruitment & Onboarding</h1>
        <p style={styles.muted}>
          {isManager
            ? "Manage vacancies, review applicants, and coordinate new-employee onboarding."
            : "Explore available vacancies, submit applications, and follow your onboarding progress."}
        </p>

        {error && (
          <div role="alert" style={{ marginTop: 16, padding: 14, borderRadius: 8, color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca" }}>
            {error}
          </div>
        )}
        {message && (
          <div role="status" style={{ marginTop: 16, padding: 14, borderRadius: 8, color: "#067647", background: "#ecfdf3", border: "1px solid #abefc6" }}>
            {message}
          </div>
        )}

        <section style={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 5px" }}>Job vacancies</h2>
              <p style={{ ...styles.muted, margin: 0 }}>
                {isManager ? "Create and manage open positions." : "Choose an open role that matches your interests."}
              </p>
            </div>
            <button style={styles.button} disabled={loading || working} onClick={() => { clearNotices(); loadData(); }}>
              Refresh
            </button>
          </div>

          {isManager && (
            <form onSubmit={createJob} style={{ marginTop: 20, padding: 18, background: "#f8fafc", borderRadius: 10 }}>
              <h3 style={{ marginTop: 0 }}>Create a vacancy</h3>
              <div style={styles.grid}>
                <div>
                  <label style={styles.label} htmlFor="job-title">Job title *</label>
                  <input id="job-title" style={styles.input} required maxLength={150} value={newJob.title} onChange={(e) => updateJobField("title", e.target.value)} />
                </div>
                <div>
                  <label style={styles.label} htmlFor="job-department">Department *</label>
                  <input id="job-department" style={styles.input} required value={newJob.department} onChange={(e) => updateJobField("department", e.target.value)} />
                </div>
                <div>
                  <label style={styles.label} htmlFor="job-location">Location *</label>
                  <input id="job-location" style={styles.input} required value={newJob.location} onChange={(e) => updateJobField("location", e.target.value)} />
                </div>
                <div>
                  <label style={styles.label} htmlFor="job-type">Employment type *</label>
                  <select id="job-type" style={styles.input} value={newJob.employment_type} onChange={(e) => updateJobField("employment_type", e.target.value)}>
                    {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label} htmlFor="job-salary">Salary range</label>
                  <input id="job-salary" style={styles.input} value={newJob.salary_range} onChange={(e) => updateJobField("salary_range", e.target.value)} placeholder="e.g. ₹4 LPA - ₹6 LPA" />
                </div>
                <div>
                  <label style={styles.label} htmlFor="job-openings">Number of openings *</label>
                  <input id="job-openings" style={styles.input} type="number" min="1" required value={newJob.openings} onChange={(e) => updateJobField("openings", e.target.value)} />
                </div>
              </div>
              <label style={styles.label} htmlFor="job-description">Job description *</label>
              <textarea id="job-description" style={{ ...styles.input, minHeight: 90, resize: "vertical" }} required value={newJob.description} onChange={(e) => updateJobField("description", e.target.value)} />
              <button type="submit" style={{ ...styles.primary, marginTop: 14 }} disabled={working}>
                {working ? "Please wait..." : "Create vacancy"}
              </button>
            </form>
          )}

          {loading ? (
            <p style={styles.muted}>Loading vacancies...</p>
          ) : jobs.length === 0 ? (
            <p style={styles.muted}>No vacancies found. HR/Admin can create a vacancy above.</p>
          ) : (
            <div style={{ ...styles.grid, marginTop: 20 }}>
              {jobs.map((job) => (
                <article key={job.id} style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                    <h3 style={{ margin: "0 0 10px", color: "#1d4ed8" }}>{job.title}</h3>
                    <span style={styles.badge}>{job.status || "OPEN"}</span>
                  </div>
                  <p style={{ margin: "5px 0" }}><strong>Department:</strong> {job.department}</p>
                  <p style={{ margin: "5px 0" }}><strong>Location:</strong> {job.location}</p>
                  <p style={{ margin: "5px 0" }}><strong>Type:</strong> {String(job.employment_type || "").replaceAll("_", " ")}</p>
                  <p style={{ margin: "5px 0" }}><strong>Openings:</strong> {job.openings}</p>
                  {job.salary_range && <p style={{ margin: "5px 0" }}><strong>Salary:</strong> {job.salary_range}</p>}
                  <p style={{ ...styles.muted, whiteSpace: "pre-wrap" }}>{job.description}</p>

                  {!isManager && job.status === "OPEN" && (
                    <>
                      <label style={styles.label} htmlFor={`cover-${job.id}`}>Cover letter (optional)</label>
                      <textarea
                        id={`cover-${job.id}`}
                        style={{ ...styles.input, minHeight: 85, resize: "vertical" }}
                        value={coverLetters[job.id] || ""}
                        onChange={(e) => setCoverLetters((current) => ({ ...current, [job.id]: e.target.value }))}
                        placeholder="Tell us why you are interested in this role..."
                      />
                      <button style={{ ...styles.primary, marginTop: 12 }} disabled={working} onClick={() => applyForJob(job.id)}>
                        Apply now
                      </button>
                    </>
                  )}

                  {isManager && job.status === "OPEN" && (
                    <button style={{ ...styles.danger, marginTop: 10 }} disabled={working} onClick={() => closeJob(job.id)}>
                      Close vacancy
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>{isManager ? "Applications" : "My applications"}</h2>
          {loading ? <p style={styles.muted}>Loading applications...</p> : applications.length === 0 ? (
            <p style={styles.muted}>{isManager ? "No applications have been submitted yet." : "You have not submitted any applications yet."}</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.cell}>Application</th>
                  <th style={styles.cell}>Job</th>
                  {isManager && <th style={styles.cell}>Applicant</th>}
                  <th style={styles.cell}>Applied</th>
                  <th style={styles.cell}>Status</th>
                  {isManager && <th style={styles.cell}>Review</th>}
                </tr></thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id}>
                      <td style={styles.cell}>#{app.id}</td>
                      <td style={styles.cell}>{app.job_title || jobs.find((job) => job.id === app.job_id)?.title || `Job #${app.job_id}`}</td>
                      {isManager && <td style={styles.cell}>{app.applicant_username || app.username || `User #${app.applicant_id}`}</td>}
                      <td style={styles.cell}>{formatDate(app.applied_at)}</td>
                      <td style={styles.cell}><span style={styles.badge}>{app.status}</span></td>
                      {isManager && (
                        <td style={styles.cell}>
                          <label style={styles.label} htmlFor={`status-${app.id}`}>New status</label>
                          <select id={`status-${app.id}`} style={styles.input} value={app.status} disabled={working} onChange={(e) => updateApplication(app.id, e.target.value)}>
                            {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          {app.status === "APPLIED" || app.status === "SHORTLISTED" || app.status === "INTERVIEW" ? (
                            <div style={{ marginTop: 8 }}>
                              <label style={styles.label} htmlFor={`interview-${app.id}`}>Interview date/time</label>
                              <input id={`interview-${app.id}`} type="datetime-local" style={styles.input} value={interviewDates[app.id] || (app.interview_date ? String(app.interview_date).slice(0, 16) : "")} onChange={(e) => setInterviewDates((current) => ({ ...current, [app.id]: e.target.value }))} />
                              <button style={{ ...styles.button, marginTop: 8 }} disabled={working} onClick={() => updateApplication(app.id, "INTERVIEW")}>Set interview</button>
                            </div>
                          ) : null}
                          {app.cover_letter && <details style={{ marginTop: 8 }}><summary>Cover letter</summary><p style={styles.muted}>{app.cover_letter}</p></details>}
                          {app.status !== "SELECTED" && app.status !== "REJECTED" && app.status !== "WITHDRAWN" && (
                            <button style={{ ...styles.primary, marginTop: 8 }} disabled={working} onClick={() => updateApplication(app.id, "SELECTED")}>Select candidate</button>
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

        <section style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>{isManager ? "Onboarding management" : "My onboarding"}</h2>
          {loading ? <p style={styles.muted}>Loading onboarding records...</p> : onboarding.length === 0 ? (
            <p style={styles.muted}>{isManager ? "No onboarding records are available. Select an applicant to create one." : "No onboarding record yet. A record appears after HR/Admin selects your application."}</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.cell}>Record</th>
                  <th style={styles.cell}>Employee</th>
                  <th style={styles.cell}>Application</th>
                  <th style={styles.cell}>Joining date</th>
                  <th style={styles.cell}>Status</th>
                  {isManager && <th style={styles.cell}>Update</th>}
                </tr></thead>
                <tbody>
                  {onboarding.map((record) => {
                    const edits = onboardingEdits[record.id] || {};
                    return (
                      <tr key={record.id}>
                        <td style={styles.cell}>#{record.id}</td>
                        <td style={styles.cell}>{record.employee_username || record.username || (isManager ? `User #${record.employee_id}` : username)}</td>
                        <td style={styles.cell}>#{record.application_id}</td>
                        <td style={styles.cell}>{formatDate(record.joining_date)}</td>
                        <td style={styles.cell}><span style={styles.badge}>{record.status}</span></td>
                        {isManager && (
                          <td style={{ ...styles.cell, minWidth: 240 }}>
                            <label style={styles.label} htmlFor={`join-${record.id}`}>Joining date</label>
                            <input id={`join-${record.id}`} type="date" style={styles.input} value={edits.joining_date ?? (record.joining_date ? String(record.joining_date).slice(0, 10) : "")} onChange={(e) => updateOnboardingField(record.id, "joining_date", e.target.value)} />
                            <label style={styles.label} htmlFor={`onboarding-status-${record.id}`}>Status</label>
                            <select id={`onboarding-status-${record.id}`} style={styles.input} value={edits.status || record.status} onChange={(e) => updateOnboardingField(record.id, "status", e.target.value)}>
                              {ONBOARDING_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                            </select>
                            <label style={styles.label} htmlFor={`notes-${record.id}`}>Notes</label>
                            <textarea id={`notes-${record.id}`} style={{ ...styles.input, minHeight: 70 }} value={edits.notes ?? record.notes ?? ""} onChange={(e) => updateOnboardingField(record.id, "notes", e.target.value)} />
                            <button style={{ ...styles.primary, marginTop: 8 }} disabled={working} onClick={() => updateOnboarding(record)}>Save onboarding</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
