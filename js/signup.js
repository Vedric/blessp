document.getElementById('registerForm').addEventListener('submit', async function(e){
    e.preventDefault();

    var firstname = document.getElementById('firstname');
    var lastname = document.getElementById('lastname');
    var email = document.getElementById('email');
    var password = document.getElementById('password');

    var fields = [firstname, lastname, email, password];
    fields.forEach(function(f){ f.classList.remove('form_field_error'); });

    if(!firstname.value.trim()){
        firstname.classList.add('form_field_error');
        showToast('Please enter your first name.', 'warning');
        firstname.focus();
        return;
    }

    if(!lastname.value.trim()){
        lastname.classList.add('form_field_error');
        showToast('Please enter your last name.', 'warning');
        lastname.focus();
        return;
    }

    if(!email.value.trim()){
        email.classList.add('form_field_error');
        showToast('Please enter your email address.', 'warning');
        email.focus();
        return;
    }

    if(password.value.length < 8){
        password.classList.add('form_field_error');
        showToast('Password must be at least 8 characters.', 'warning');
        password.focus();
        return;
    }

    var data = {
        firstname: firstname.value.trim(),
        lastname: lastname.value.trim(),
        email: email.value.trim(),
        password: password.value
    };

    try {
        var response = await fetch('/api.php/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        var result = await response.json();

        if(response.ok){
            showToast('Account created! Redirecting to sign in...', 'success');
            setTimeout(function(){
                location = './signin.php';
            }, 1500);
        } else {
            showToast(result.error || 'Registration failed. Please try again.', 'error');
        }
    } catch(error) {
        console.error(error);
        showToast('Connection error. Please try again.', 'error');
    }
});
