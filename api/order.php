<?php
namespace Shop;

class Order {
    public $orderInfos;
    public $customer;
    public $orderItems;

    // Constructor method
    public function __construct($orderInfos, $customer, $orderItems) {
        $this->orderInfos = $orderInfos;
        $this->customer = $customer;
        $this->orderItems = $orderItems;
    }
}

?>