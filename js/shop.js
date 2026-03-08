function displayArticles(articles, filter){
    var filteredArticles = articles;
    if(filter != null && filter.length > 0){
        filteredArticles = articles.filter(function(article){
            return article.category.includes("[" + filter + "]");
        });
    }

    var articleBox = document.getElementById("articleBox");

    filteredArticles.forEach(function(article){
        var articleDiv = document.createElement("div");
        articleDiv.className = "article";
        articleDiv.style.backgroundImage = "url('/img/" + article.picture + "')";
        articleDiv.onclick = function(){
            location = "product.php?id=" + article.id;
        };

        var articleDetail = document.createElement("div");
        articleDetail.className = "articleDetail";

        var articleName = document.createElement("span");
        articleName.className = "articleName";
        articleName.textContent = article.name;

        var articlePrice = document.createElement("span");
        articlePrice.className = "articlePrice";
        articlePrice.textContent = article.price;

        articleDetail.appendChild(articleName);
        articleDetail.appendChild(articlePrice);
        articleDiv.appendChild(articleDetail);
        articleBox.appendChild(articleDiv);
    });
}

var params = getParams();
var category = params.get("cat");

$.getJSON("/api.php/active_products", function(json){
    var articles = json.data;
    displayArticles(articles, category);
});
