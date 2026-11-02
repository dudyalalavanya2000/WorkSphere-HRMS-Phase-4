import { useEffect, useState } from "react";
import axios from "axios";
import "./ProfileSettings.css";

const API_URL = "http://127.0.0.1:8000";

const emptyProfile = {
  username: "",
  email: "",
  role: "",
  is_active: false,
  department: "",
  designation: "",
  phone_number: "",
  joining_date: "",
  employment_status: "",
  created_at: "",
};

export default function ProfileSettings() {
  const token = localStorage.getItem("access_token");

  const [profile, setProfile] = useState(emptyProfile);
  const [form, setForm] = useState({
    username: "",
    email: "",
    department: "",
    designation: "",
    phone_number: "",
    joining_date: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_URL}/api/v1/profile/me`,
        authHeaders
      );

      const data = response.data;
      setProfile(data);

      setForm({
        username: data.username || "",
        email: data.email || "",
        department: data.department || "",
        designation: data.designation || "",
        phone_number: data.phone_number || "",
        joining_date: data.joining_date || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadProfile();
  }, [token]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        phone_number: form.phone_number.trim() || null,
        joining_date: form.joining_date || null,
      };

      const response = await axios.patch(
        `${API_URL}/api/v1/profile/me`,
        payload,
        authHeaders
      );

      setProfile(response.data);
      setForm({
        username: response.data.username || "",
        email: response.data.email || "",
        department: response.data.department || "",
        designation: response.data.designation || "",
        phone_number: response.data.phone_number || "",
        joining_date: response.data.joining_date || "",
      });

      localStorage.setItem("username", response.data.username);
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/profile/change-password`,
        passwordForm,
        authHeaders
      );

      setPasswordSuccess(
        response.data.message || "Password changed successfully."
      );
      setPasswordForm({
        current_password: "",
        new_password: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.detail || "Unable to change your password."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return <div className="profile-page"><p>Loading profile...</p></div>;
  }

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-heading">
          <div>
            <h1>Profile & Settings</h1>
            <p>View and manage your personal account information.</p>
          </div>
          <a className="profile-back-link" href="/dashboard">
            ← Dashboard
          </a>
        </div>

        {error && <div className="profile-alert error">{error}</div>}
        {success && <div className="profile-alert success">{success}</div>}

        <section className="profile-card account-card">
          <div className="profile-avatar">
            {(profile.username || "U").charAt(0).toUpperCase()}
          </div>
          <div className="account-info">
            <h2>{profile.username}</h2>
            <p>{profile.email}</p>
            <div className="account-tags">
              <span className="profile-tag">{profile.role}</span>
              <span
                className={`profile-tag ${
                  profile.is_active ? "active-tag" : "inactive-tag"
                }`}
              >
                {profile.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </section>

        <section className="profile-card">
          <h2>Personal Information</h2>
          <p className="section-description">
            Update your account and employment details.
          </p>

          <form onSubmit={handleProfileSubmit}>
            <div className="profile-form-grid">
              <div className="profile-field">
                <label htmlFor="profile-username">Username</label>
                <input
                  id="profile-username"
                  name="username"
                  value={form.username}
                  onChange={handleFormChange}
                  minLength={3}
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-department">Department</label>
                <input
                  id="profile-department"
                  name="department"
                  value={form.department}
                  onChange={handleFormChange}
                  placeholder="Enter department"
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-designation">Designation</label>
                <input
                  id="profile-designation"
                  name="designation"
                  value={form.designation}
                  onChange={handleFormChange}
                  placeholder="Enter designation"
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-phone">Phone Number</label>
                <input
                  id="profile-phone"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleFormChange}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="profile-field">
                <label htmlFor="profile-joining-date">Joining Date</label>
                <input
                  id="profile-joining-date"
                  name="joining_date"
                  type="date"
                  value={form.joining_date}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <button className="profile-primary-button" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </section>

        <section className="profile-card">
          <h2>Change Password</h2>
          <p className="section-description">
            Enter your current password and choose a new password.
          </p>

          {passwordError && (
            <div className="profile-alert error">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="profile-alert success">{passwordSuccess}</div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="profile-form-grid">
              <div className="profile-field">
                <label htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="profile-primary-button"
              disabled={changingPassword}
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>

        <section className="profile-card account-details-card">
          <h2>Account Details</h2>
          <div className="account-detail-row">
            <span>Role</span>
            <strong>{profile.role || "—"}</strong>
          </div>
          <div className="account-detail-row">
            <span>Employment Status</span>
            <strong>{profile.employment_status || "Not specified"}</strong>
          </div>
          <div className="account-detail-row">
            <span>Account Created</span>
            <strong>
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN")
                : "—"}
            </strong>
          </div>
        </section>
      </div>
    </main>
  );
}