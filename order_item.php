<?php
namespace Shop;

class OrderItem {
    public $articleName;
    public $articleCode;
    public $articleSize;
    public $articleColor;
    public $qty;
    public $unitPrice;
    public $picture;
    
    // Constructor method
    public function __construct($articleName, $articleCode, $articleSize, $articleColor, $qty, $unitPrice, $picture) {
        
        $this-> articleName = $articleName;
        $this-> articleCode = $articleCode;
        $this-> articleSize = $articleSize;
        $this-> articleColor = $articleColor;
        $this-> qty = $qty;
        $this-> unitPrice = $unitPrice;
        $this-> picture = $picture;

    }
}


?>