<!doctype html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
    </head>
    <script type="text/javascript" src="/js/path.js?v=1.1.0"></script>

    <body>
        <?php
            include './config.php';
            include './authent.php';
            include './header.php';
            include './navshop.php';
        ?>
        <input type="hidden" id="productId" />
        <input type="hidden" id="colorCode" />
        <div id="productDiv" class="productDiv">
            <div id="minsContainer" class="minsContainer">
            </div>
            <div id="imgContainer" class="imgContainer">
            </div>
            <div id="purchaseContainer" class="purchaseContainer">
                <div class="articleName"><span id="articleName" class="articleName"></span></div>
                <div class="articlePrice"><span id="articlePrice" class="articlePrice"></span></div>
                <div class="articleSize"><span class="articleSize">Size</span><span id="articleSize"></span></div>
                <div id="articleSizes" class="articleSizes">
                    <div class="articleSizeItem">XS</div>
                    <div class="articleSizeItem">S</div>
                    <div class="articleSizeItem">M</div>
                    <div class="articleSizeItem">L</div>
                    <div class="articleSizeItem">XL</div>
                </div>
                <div class="articleColor"><span class="articleColor">Color</span><span id="articleColor"></span></div>
                <div id="articleColors" class="articleColors">
                </div>
                <div class="cartCmds">
                    <div id="quantityDiv" class="quantityDiv">
                        <button id="qtyMinus" class="btnQtyMinus btnQty">-</button>
                        <div id="quantity" class="quantity">1</div>
                        <button id="qtyPlus" class="btnQtyPlus btnQty">+</button>
                    </div>
                    <div id="addCartDiv">
                        <button class="addToCartBtn" id="addToCartBtn">Add to cart</button>
                    </div>
                </div>
                <div class="detailsTitle"><span class="detailsTitle">Description and details</span></div>
                <div class="articleDetails" id="articleDetails"></div>
            </div>
        </div>
        <div style="padding: 0 var(--content-padding); max-width: var(--container-max); margin: 0 auto;">
            <h3>You might also like</h3>
        </div>
        <div id="otherProducts" class="otherProducts">
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script src="/js/slidepanel.js?v=1.1.0"></script>
    <script src="/js/header.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/product.js?v=1.1.0"></script>
</html>
