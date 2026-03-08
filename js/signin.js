document.getElementById('registerForm').addEventListener('submit', async function(e){
    e.preventDefault();

    var email = document.getElementById('email');
    var password = document.getElementById('password');

    email.classList.remove('form_field_error');
    password.classList.remove('form_field_error');

    if(!email.value.trim()){
        email.classList.add('form_field_error');
        showToast('Please enter your email address.', 'warning');
        email.focus();
        return;
    }

    if(!password.value){
        password.classList.add('form_field_error');
        showToast('Please enter your password.', 'warning');
        password.focus();
        return;
    }

    var data = {
        email: email.value.trim(),
        password: password.value
    };

    try {
        var response = await fetch('/api.php/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        var result = await response.json();

        if(response.ok){
            showToast('Welcome back!', 'success');
            setTimeout(function(){
                location = './home.php';
            }, 500);
        } else {
            showToast(result.error || 'Invalid email or password.', 'error');
        }
    } catch(error) {
        console.error(error);
        showToast('Connection error. Please try again.', 'error');
    }
});
