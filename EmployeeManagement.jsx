
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const emptyProfile = {
  department: "",
  designation: "",
  phone_number: "",
  joining_date: "",
  employment_status: "ACTIVE",
};

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const role = (
    localStorage.getItem("user_role") || "EMPLOYEE"
  ).toUpperCase();

  const isHR = role === "HR" || role === "ADMIN";

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [profileForm, setProfileForm] = useState({ ...emptyProfile });
  const [newUserId, setNewUserId] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    setLoading(true);
    setError("");

    try {
      const endpoint = isHR
        ? `${API_URL}/api/v1/employees/`
        : `${API_URL}/api/v1/employees/me`;

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const results = isHR ? response.data : [response.data];

      setEmployees(Array.isArray(results) ? results : []);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");

        navigate("/", { replace: true });
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load employee information. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    loadEmployees();
  }, []);

  function selectEmployee(employee) {
    setSelectedEmployee(employee);
    setMessage("");
    setError("");

    const profile = employee.employee_profile;

    setProfileForm(
      profile
        ? {
            department: profile.department || "",
            designation: profile.designation || "",
            phone_number: profile.phone_number || "",
            joining_date: profile.joining_date
              ? String(profile.joining_date).slice(0, 10)
              : "",
            employment_status:
              profile.employment_status || "ACTIVE",
          }
        : { ...emptyProfile }
    );

    setNewUserId(String(employee.id));
  }

  function updateField(event) {
    const { name, value } = event.target;

    setProfileForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const userId = selectedEmployee?.id || Number(newUserId);

    if (!userId || userId < 1) {
      setError("Enter a valid user ID.");
      setSaving(false);
      return;
    }

    const payload = {
      department: profileForm.department || null,
      designation: profileForm.designation || null,
      phone_number: profileForm.phone_number || null,
      joining_date: profileForm.joining_date || null,
      employment_status:
        profileForm.employment_status || "ACTIVE",
    };

    try {
      const hasProfile = Boolean(
        selectedEmployee?.employee_profile
      );

      if (hasProfile) {
        await axios.patch(
          `${API_URL}/api/v1/employees/${userId}/profile`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setMessage("Employee profile updated successfully.");
      } else {
        await axios.post(
          `${API_URL}/api/v1/employees/${userId}/profile`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setMessage("Employee profile created successfully.");
      }

      await loadEmployees();

      if (!isHR) {
        setSelectedEmployee(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to save the profile. Please check the details and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const query = search.toLowerCase();
    const profile = employee.employee_profile || {};

    return [
      employee.username,
      employee.email,
      employee.role,
      profile.department,
      profile.designation,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="employee-page">
      <header className="employee-header">
        {/* Brand icon removed: show only the WorkSphere name */}
        <div className="brand">
          <span>WorkSphere</span>
        </div>

        <div className="employee-header-actions">
          <span className="role-label">{role}</span>

          <button
            className="secondary-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="employee-content">
        <p className="eyebrow">PEOPLE OPERATIONS</p>

        <h1>Employee Management</h1>

        <p className="subtitle">
          View employee information and manage employee profiles.
        </p>

        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="notice notice-success" role="status">
            {message}
          </div>
        )}

        {isHR && (
          <section className="employee-panel">
            <h2>Create an employee profile</h2>

            <p className="panel-description">
              Enter an existing user's ID to create a profile for that user.
            </p>

            <form
              onSubmit={handleSaveProfile}
              className="profile-form"
            >
              <label htmlFor="newUserId">User ID</label>

              <input
                id="newUserId"
                type="number"
                min="1"
                value={newUserId}
                onChange={(event) => {
                  setNewUserId(event.target.value);
                  setSelectedEmployee(null);
                  setProfileForm({ ...emptyProfile });
                }}
                placeholder="Enter an existing user ID"
                required
              />

              <p className="panel-description">
                To edit an existing profile, select that employee
                from the directory below.
              </p>

              <ProfileFields
                form={profileForm}
                onChange={updateField}
              />

              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create / Save Profile"}
              </button>
            </form>
          </section>
        )}

        <section className="employee-panel">
          <div className="employee-list-heading">
            <div>
              <h2>{isHR ? "Employee directory" : "My profile"}</h2>

              <p className="panel-description">
                {isHR
                  ? `${employees.length} user record(s) found`
                  : "Your employee information from the server"}
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={loadEmployees}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>

          {isHR && (
            <input
              className="search-input"
              type="search"
              placeholder="Search by username, email, department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}

          {loading ? (
            <p className="empty-state">
              Loading employee records...
            </p>
          ) : error && employees.length === 0 ? (
            <p className="empty-state">
              No records could be loaded.
            </p>
          ) : filteredEmployees.length === 0 ? (
            <p className="empty-state">
              No matching employee records found.
            </p>
          ) : (
            <div className="employee-table-wrapper">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Designation</th>
                    {isHR && <th>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => {
                    const profile = employee.employee_profile || {};

                    return (
                      <tr key={employee.id}>
                        <td>{employee.id}</td>
                        <td>{employee.username}</td>
                        <td>{employee.email}</td>

                        <td>
                          <span className="employee-role">
                            {employee.role}
                          </span>
                        </td>

                        <td>
                          {profile.department || "Not assigned"}
                        </td>

                        <td>
                          {profile.designation || "Not assigned"}
                        </td>

                        {isHR && (
                          <td>
                            <button
                              className="table-action"
                              onClick={() => selectEmployee(employee)}
                            >
                              {employee.employee_profile
                                ? "Edit"
                                : "Create"}
                            </button>
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

        {isHR && selectedEmployee && (
          <section className="employee-panel">
            <h2>
              Edit profile: {selectedEmployee.username} (ID{" "}
              {selectedEmployee.id})
            </h2>

            {selectedEmployee.employee_profile ? (
              <form
                onSubmit={handleSaveProfile}
                className="profile-form"
              >
                <ProfileFields
                  form={profileForm}
                  onChange={updateField}
                />

                <div className="form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Update Profile"}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setSelectedEmployee(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="panel-description">
                This user does not have an employee profile yet.
                Use the create form above with user ID{" "}
                {selectedEmployee.id}.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function ProfileFields({ form, onChange }) {
  return (
    <div className="profile-fields">
      <div>
        <label htmlFor="department">Department</label>
        <input
          id="department"
          name="department"
          value={form.department}
          onChange={onChange}
          placeholder="e.g. Engineering"
        />
      </div>

      <div>
        <label htmlFor="designation">Designation</label>
        <input
          id="designation"
          name="designation"
          value={form.designation}
          onChange={onChange}
          placeholder="e.g. Software Developer"
        />
      </div>

      <div>
        <label htmlFor="phone_number">Phone number</label>
        <input
          id="phone_number"
          name="phone_number"
          value={form.phone_number}
          onChange={onChange}
          placeholder="Enter phone number"
        />
      </div>

      <div>
        <label htmlFor="joining_date">Joining date</label>
        <input
          id="joining_date"
          name="joining_date"
          type="date"
          value={form.joining_date}
          onChange={onChange}
        />
      </div>

      <div>
        <label htmlFor="employment_status">
          Employment status
        </label>

        <select
          id="employment_status"
          name="employment_status"
          value={form.employment_status}
          onChange={onChange}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ON_LEAVE">On leave</option>
        </select>
      </div>
    </div>
  );
}
