import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Papa from "papaparse";
import "../styles/Styles.css";

const DataEntry = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [coffeeData, setCoffeeData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // for search filter

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch existing coffee_data from the database
  useEffect(() => {
    const fetchCoffeeData = async () => {
      const { data, error } = await supabase.from("coffee_data").select("*");
      if (!error) setCoffeeData(data);
    };
    fetchCoffeeData();
  }, []);

  // Fetch authenticated user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("first_name, last_name, role")
          .eq("email", user.email)
          .single();
        if (!error) setUser(data);
      } else {
        navigate("/login");
      }
    };
    fetchUser();
  }, [navigate]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setCsvData(result.data);
          setShowPreviewModal(true); // Show preview modal
        },
      });
    }
  };

  const handleRemoveFile = () => {
    setFileName("");
    setCsvData([]);
    document.getElementById("file-input").value = "";  // Clear file input
  };

  const handleSubmit = async () => {
    if (!csvData.length) return alert("No data to upload!");
    setIsUploading(true);
    try {
      const { error } = await supabase.from("coffee_data").insert(csvData);
      if (error) throw error;
      alert("Data uploaded successfully!");
      setCsvData([]);
      setFileName("");
      setShowPreviewModal(false); // Close the preview modal
    } catch (error) {
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Form state for adding/editing data
  const [formData, setFormData] = useState({
    season: "",
    month: "",
    ripe_percentage: "",
    unripe_percentage: "",
    ph_level: "",
    nitrogen: "",
    phosphorus: "",
    potassium: "",
    calcium: "",
    magnesium: "",
    organic_matter: "",
    avg_temperature: "",
    avg_rainfall: "",
    coffee_berry_borer: "",
    green_coffee_scale: "",
    coffee_leaf_rust: "",
    root_rot: "",
    coffee_berry_disease: "",
    mealybugs_aphids: "",
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add a new record
  const handleAddRecord = async () => {
    // Validate fields for non-empty values
    if (!formData.season || !formData.month) {
      return alert("Season and Month are required!");
    }

    if (isEditing) {
      // Update existing record
      const { error } = await supabase
        .from("coffee_data")
        .update(formData)
        .eq("id", editId);

      if (!error) {
        setCoffeeData((prev) =>
          prev.map((item) => (item.id === editId ? { ...item, ...formData } : item))
        );
        alert("Record updated successfully!");
      } else {
        alert("Failed to update record!");
      }

      setIsEditing(false);
      setEditId(null);
    } else {
      // Insert new record
      const { data, error } = await supabase.from("coffee_data").insert([formData]);
      if (!error) {
        setCoffeeData([...coffeeData, data[0]]);
        alert("Record added successfully!");
      } else {
        alert("Failed to add record!");
      }
    }

    setFormData({
      season: "",
      month: "",
      ripe_percentage: "",
      unripe_percentage: "",
      ph_level: "",
      nitrogen: "",
      phosphorus: "",
      potassium: "",
      calcium: "",
      magnesium: "",
      organic_matter: "",
      avg_temperature: "",
      avg_rainfall: "",
      coffee_berry_borer: "",
      green_coffee_scale: "",
      coffee_leaf_rust: "",
      root_rot: "",
      coffee_berry_disease: "",
      mealybugs_aphids: "",
    });
  };

  // Edit a record
  const handleEdit = (record) => {
    setFormData(record);
    setIsEditing(true);
    setEditId(record.id);
  };

  // Delete a record
  const handleDelete = async (id) => {
    const { error } = await supabase.from("coffee_data").delete().eq("id", id);
    if (!error) {
      setCoffeeData(coffeeData.filter((record) => record.id !== id));
      alert("Record deleted successfully!");
    } else {
      alert("Failed to delete record!");
    }
  };

  // Filter coffee data based on search query
  const filteredCoffeeData = coffeeData.filter((record) =>
    Object.values(record).some(value =>
      value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="page-container">
      {/* Modal for Preview */}
      {showPreviewModal && (
        <div className="modal">
          <div className="modal-content" style={{ padding: "50px", maxWidth: "80%", margin: "0 auto" }}>
            <h3>Preview Uploaded CSV Data</h3>
            <table>
              <thead>
                <tr>
                  {Object.keys(csvData[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((value, id) => (
                      <td key={id}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => setShowPreviewModal(false)}>Close</button>
              <button onClick={handleSubmit} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="page-header">
        <div className="logo">☕</div>
        <b><p>Data Entry</p></b>
        <div className="user-info">
          {user && <span>{user.role} | {user.first_name} {user.last_name}</span>}
          {user && (
            <button onClick={() => supabase.auth.signOut()} className="logout-btn">Logout</button>
          )}
        </div>
      </header>

      <div className="page-main">
        <nav className="sidebar">
          <ul>
            <li onClick={() => navigate("/dashboard")} className={location.pathname === "/dashboard" ? "active" : ""}>Dashboard</li>
            <li onClick={() => navigate("/user-management")} className={location.pathname === "/user-management" ? "active" : ""}>Farmer Management</li>
            <li onClick={() => navigate("/predictive-analytics")} className={location.pathname === "/predictive-analytics" ? "active" : ""}>Predictive Analytics</li>
            <li onClick={() => navigate("/data-entry")} className={location.pathname === "/data-entry" ? "active" : ""}>Data Entry</li>
            <li onClick={() => navigate("/dss-recommendations")} className={location.pathname === "/dss-recommendations" ? "active" : ""}>DSS Recommendations</li>
          </ul>
        </nav>

        <main className="content">
          <h2>Manage Coffee Data</h2>

          {/* File Upload */}
          <input type="file" id="file-input" accept=".csv" onChange={handleFileUpload} />
          {fileName && (
            <div className="file-info">
              <p>File: {fileName}</p>
              <button onClick={handleRemoveFile}>Remove File</button>
            </div>
          )}

          {/* Form for Manual Entry */}
          <div className="form-container">
            <h3>{isEditing ? "Edit Record" : "Add New Record"}</h3>
            <form>
              {Object.keys(formData).map((key) => (
                <div key={key} className="form-group">
                  <label>{key.replace(/_/g, " ").toUpperCase()}</label>
                  <input
                    type="text"
                    name={key}
                    value={formData[key]}
                    onChange={handleInputChange}
                    placeholder={`Enter ${key.replace(/_/g, " ")}`}
                  />
                </div>
              ))}
              <button type="button" onClick={handleAddRecord}>
                {isEditing ? "Update Record" : "Add Record"}
              </button>
            </form>
          </div>

          {/* Search Filter */}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />

          {/* Display Data Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {coffeeData.length > 0 &&
                    Object.keys(coffeeData[0]).map((key) => <th key={key}>{key}</th>)}
                  <th className="sticky">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoffeeData.map((record) => (
                  <tr key={record.id}>
                    {Object.values(record).map((value, idx) => (
                      <td key={idx}>{value}</td>
                    ))}
                    <td className="sticky">
                      <button onClick={() => handleEdit(record)}>Edit</button>
                      <button onClick={() => handleDelete(record.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataEntry;
