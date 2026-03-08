document.getElementById('registerForm').addEventListener('submit', async function (e) {
            e.preventDefault();

            const data = {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            };

            try {
                const response = await fetch('/api.php/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                //console.log(result);
                //alert('Réponse du serveur : ' + JSON.stringify(result));
                location = "./home.php";
            } catch (error) {
                console.error(error);
                alert('Erreur lors de l\'envoi des données');
            }
        });