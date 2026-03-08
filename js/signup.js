document.getElementById('registerForm').addEventListener('submit', async function (e) {
            e.preventDefault();

            const data = {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                firstname: document.getElementById('firstname').value,
                lastname: document.getElementById('lastname').value
            };

            try {
                const response = await fetch('/api.php/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                console.log(result);
                alert('Réponse du serveur : ' + JSON.stringify(result));
            } catch (error) {
                console.error(error);
                alert('Erreur lors de l\'envoi des données');
            }
        });