function displayArticles(articles, filter){
	const screenWidth = window.screen.width;
    var filteredArticles = articles;
    if(filter!=null&&filter.length>0){
        filteredArticles = articles.filter(article=>article.category.includes("[" + filter + "]"));
    }
    
    filteredArticles.forEach(article => {
        var articleBox = document.getElementById("articleBox");
        var articleDiv = document.createElement("div");
		var articleDetail = document.createElement("div");
		if(screenWidth<400){
			
			console.log("Screen width: " + screenWidth);
			articleDiv.className="articleMobile";
			let divWidth = screenWidth/2;
			let divHeight = divWidth*1.5;
			
			divWidth = Math.round(divWidth) - 10;
			divHeight = Math.round(divHeight) + 35;
			
			console.log("Div width: " + divWidth + " Div height: " + divHeight);
			articleDiv.style.width = divWidth + "px";
			articleDiv.style.height= divHeight + "px";
			articleDiv.style.backgroundSize = divWidth + "px";
			
			let articleMarginTop = divHeight - 35;
			articleDetail.className="articleDetailMobile";
			articleDetail.style.marginTop = articleMarginTop + "px";
			
		}else{
			articleDiv.className="article";
			articleDetail.className="articleDetail";
		}
        
        articleDiv.style.backgroundImage = "url('/img/" + article.picture + "')";
        //var addToCartDiv = document.createElement("button");
        //addToCartDiv.textContent = "Add to cart";
        articleDiv.onclick = function(){
            location = "product.php?id=" + article.id;
        }


        
        
        var articleName = document.createElement("span");
        articleName.className = "articleName";
        articleName.textContent = article.name;
        var articlePrice = document.createElement("span");
        articlePrice.className="articlePrice";
        articlePrice.textContent = article.price;

        articleDetail.appendChild(articleName);
        articleDetail.appendChild(articlePrice);
        //articleDiv.appendChild(addToCartDiv);
        articleDiv.appendChild(articleDetail);
        articleBox.appendChild(articleDiv);
        
    });
}
var params = getParams();

const category = params.get("cat");

$.getJSON("/api.php/active_products",function(json){
    const articles = json.data;
    displayArticles(articles, category);
})
