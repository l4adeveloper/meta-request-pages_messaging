import React from "react";

function Login() {
  const handleLogin = () => {
    // redirect sang backend để login Meta OAuth
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    window.location.href = `${apiUrl}/auth/login`;
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20%" }}>
      <h1>Meta Dashboard Login</h1>
      <button onClick={handleLogin}>Login with Meta</button>
    </div>
  );
}

export default Login;
