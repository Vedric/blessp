<!doctype html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
    </head>
    

    <body>
        <?php 
            include './config.php';
            include './authent.php';
            include './header.php'; 
            
        ?>
        <div id="container" class="container">
            <div class="signForm">
                <h2>Sign up</h2>
                <form id="registerForm">
                    <label>Firstname :</label><br />
                    <input type="text" id="firstname" required /><br /><br />

                    <label>Lastname :</label><br />
                    <input type="text" id="lastname" required /><br /><br />

                    <label>Email :</label><br />
                    <input type="email" id="email" required /><br /><br />

                    <label>Password :</label><br />
                    <input type="password" id="password" required /><br /><br />

                    <button type="submit">S'inscrire</button>
                </form>
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/header.js?v=1.0.201" ></script>
	<script type="text/javascript" src="./js/signup.js?v=1.0.201"></script>
	<script>
    	var minH = window.innerHeight - 304;
	    $(".container").css('min-height',minH);
	</script>
</html>
