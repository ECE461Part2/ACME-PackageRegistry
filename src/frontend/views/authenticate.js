function authenticate() {
  const form = document.getElementById('login-form');
  const username = form.elements.username.value;
  const password = form.elements.password.value;
  console.log("HIII")

  fetch('/authenticate', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: username,
      password: password
    })
  })
  .then(response => response.json())
  .then(data => {
    // store the bearer token in localStorage
    localStorage.setItem('bearerToken', data.token);

    // redirect to profile page
    window.location.href = '/profile';
  })
  .catch(error => console.error(error));
}
