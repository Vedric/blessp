<!DOCTYPE html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
        <link href="../css/admin.css" rel="stylesheet">
    </head>
    <body>
        <?php 
            include '../config.php';
            include '../authent.php';
            include '../header.php'; 
            //include 'navshop.php';
            

            $loggedUser = getAuthenticatedUser($config);

            if(!$loggedUser || !$loggedUser['admin']){
                "You are not logged or are not admin.";
            }
        ?>
    <div class="container" style="display:block;">
        <div class="pagePath">
                <a href="../admin_home.php">Admin home</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <a href="./products.php">Products</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <span>Product</span>
        </div>
        <div id="product" style="width:60%; min-width: 300px;margin:auto;">
            <form id="productForm" enctype="multipart/form-data">
                <input type="hidden" name="productId" id="productId">

                <label>Nom du produit</label>
                <input type="text" name="productName" id="productName" required>

                <label>Image du produit</label>
                <div class="drop-zone" id="dropZone">Cliquez ou glissez une image</div>
                <input type="file" name="productPicture" id="productPicture" accept="image/*" hidden>

                <div class="preview">
                    <img id="imagePreview">
                </div>
                
                <label for="secondary_pictures">Images secondaires</label>
  				<input type="text" id="secondary_pictures" name="secondary_pictures">

                <label>Prix</label>
                <input type="number" step="0.01" name="price" id="price" required>

                <label>Catégories</label>
                <input type="text" name="categories" id="categories">
                
                <label>Couleur</label>
                <input type="text" name="colors" id="colors">

                <label>Description</label>
                <textarea name="details" id="details"></textarea>
                
                <label>On front (order)</label>
                <input type="number" name="onfront_order" id="onfront_order" step="1">

                <label>Active</label>
                <input type="checkbox" name="activeChk" id="activeChk"></textarea>
                <input type="text" name="active" id="active" hidden>
                <button id="formSubmitBtn">Sauvegarder</button>
                
            </form>
            
        </div>
    </div>
</body>
</html>
<script src="/js/slidepanel.js?v=1.0.123" ></script>
<script src="/js/header.js?v=1.0.123" ></script>
<script src="/js/path.js?v=1.0.123"></script>
<script>

    const productId = getParam("id");

    const url = "/api/products.php/product?id=" + productId;

    $.getJSON(url, function(data){
        const product = data[0];
        $('#productId').val(product.id);
        $('#productName').val(product.name);
        $('#price').val(product.price);
        $('#categories').val(product.category);
        $('#details').val(product.details);
        $('#active').val(product.active);
        $('#secondary_pictures').val(product.secondary_pictures);
        $('#colors').val(product.colors);
        $('#onfront_order').val(product.onfront_order);
        if(product.onfront_order == null || product.onfront_order ==""){
        	$('#onfront_order').val(0);

        }
        if(product.active){
            $('#activeChk').prop('checked', true);
        }else{
            $('#activeChk').prop('checked', false);
        }

        if (product.picture) {
            $('#imagePreview').attr('src', '../img/' + product.picture).show();
        }
    });

    // Upload image + preview
    $('#dropZone').on('click', () => $('#productPicture').click());

    $('#productPicture').on('change', function () {
        previewFile(this.files[0]);
    });

    $('#dropZone').on('dragover', e => { e.preventDefault(); $('#dropZone').addClass('dragover'); });
    $('#dropZone').on('dragleave', () => $('#dropZone').removeClass('dragover'));
    $('#dropZone').on('drop', e => {
        e.preventDefault();
        $('#dropZone').removeClass('dragover');
        const file = e.originalEvent.dataTransfer.files[0];
        $('#productPicture')[0].files = e.originalEvent.dataTransfer.files;
        previewFile(file);
    });

    function previewFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => $('#imagePreview').attr('src', e.target.result).show();
        reader.readAsDataURL(file);
    }

    // POST AJAX en jQuery
    $('#productForm').on('submit', function (e) {
        e.preventDefault();

        const formData = new FormData(this);

        $.ajax({
            url: './saveproduct.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                location="./products.php";
            },
            error: function () {
                alert('Erreur lors de la sauvegarde');
            }
        });
    });

    $("#activeChk").on('click', function(e){
        console.log('CHECKED: ' + $(this).prop('checked'));
        $('#active').val(""+$(this).prop('checked'));
    });

</script>