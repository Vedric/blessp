function createList(eltId, json, header){
    var target = $("#"+eltId);
    var table = createElt("table");
    table.id = "ordersTable";
    var thead = createElt("thead");
    var hrow = createElt("tr");
    $.each(header, function(index, object){
        var hcell = createElt("th");
        hcell.textContent = `${object['name']}`;
        hrow.append(hcell);
        
    });
    thead.append(hrow);
    table.append(thead);
    var tbody = createElt("tbody");
    table.append(tbody);
    var rowNumber = 0;
    $.each(json,function(index,object){
        
        rowNumber++;
        var row = createElt("tr");
        row.classList.add("rw");
        row.id = "r" + rowNumber;
        tbody.append(row);

        var cellNumber = 0;
		
		$.each(header, function(idx, coldef){

			var column = coldef.column;
			var colName = `${object['column']}`;
			cellNumber++;
			var cell = createElt("td");
			cell.classList.add("cl");
			cell.classList.add("cl" + cellNumber);
			cell.id= "r" + rowNumber + "c" + cellNumber;
			cell.textContent = object[column];
			row.append(cell);
				
		});
        
    });
    target.append(table);
}

function createElt(name){
    return document.createElement(name);
}

