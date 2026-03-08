<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Éditer un produit</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 30px;
    }

    form {
      max-width: 600px;
      background: #fff;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h2 {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-top: 15px;
      font-weight: bold;
    }

    input[type="text"],
    input[type="number"],
    textarea {
      width: 100%;
      padding: 10px;
      margin-top: 6px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    textarea {
      resize: vertical;
      min-height: 100px;
    }

    .drop-zone {
      margin-top: 10px;
      padding: 25px;
      border: 2px dashed #aaa;
      border-radius: 6px;
      text-align: center;
      color: #666;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .drop-zone.dragover {
      background: #eef6ff;
      border-color: #3399ff;
    }

    .preview {
      margin-top: 15px;
    }

    .preview img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 4px;
      display: none;
    }

    button {
      margin-top: 25px;
      padding: 12px 20px;
      background: #3399ff;
      color: #fff;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
    }

    button:hover {
      background: #2b85db;
    }
  </style>
</head>
<body>

<form id="productForm">
  <h2>Éditer un produit</h2>

  <label for="productName">Nom du produit</label>
  <input type="text" id="productName" name="productName" required>

  <label>Image du produit</label>
  <div class="drop-zone" id="dropZone">
    Glissez-déposez une image ici ou cliquez pour parcourir
    <input type="file" id="productPicture" name="productPicture" accept="image/*" hidden>
  </div>
  <label for="secondary_pictures">Images secondaires</label>
  <input type="text" id="secondary_pictures" name="secondary_pictures">

  <div class="preview">
    <img id="imagePreview" alt="Aperçu du produit">
  </div>

  <label for="price">Prix unitaire (€)</label>
  <input type="number" id="price" name="price" step="0.01" min="0" required>

  <label for="categories">Catégories</label>
  <input type="text" id="categories" name="categories" placeholder="Ex : vêtements, sport, été">

  <label for="details">Description du produit</label>
  <textarea id="details" name="details"></textarea>

  <button type="submit">Enregistrer le produit</button>
</form>

<script>
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("productPicture");
  const previewImage = document.getElementById("imagePreview");

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      previewFile(fileInput.files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      previewFile(fileInput.files[0]);
    }
  });

  function previewFile(file) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      previewImage.src = reader.result;
      previewImage.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
</script>

</body>
</html>
