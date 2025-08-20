import React from "react";

function Login() {
  const handleLogin = () => {
    // redirect sang backend để login Meta OAuth
    window.location.href = "https://localhost:5000/auth/login";
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20%" }}>
      <h1>Meta Dashboard Login</h1>
      <button onClick={handleLogin}>Login with Meta</button>
    </div>
  );
}

export default Login;
