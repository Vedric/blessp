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
            include './navshop.php';
        ?>
        <div class="container">
            <div class="articleBox" id="articleBox"></div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/header.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/path.js?v=1.0.201"></script>
	<script type="text/javascript" src="/js/shop.js?v=1.0.201"></script>
	<script type="text/javascript" >
    	var minH = window.innerHeight - 244;
    	$(".container").css('min-height',minH);
	</script>
</html>
