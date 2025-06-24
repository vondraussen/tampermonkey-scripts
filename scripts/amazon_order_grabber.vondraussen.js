// ==UserScript==
// @name         Amazon Order Grabber
// @namespace    http://tampermonkey.net/
// @version      2025-06-24
// @description  Grab Amazon order details and send them to an API endpoint
// @author       vondraussen
// @match        https://sellercentral.amazon.de/orders-v3/fba/all*
// @icon         https://sellercentral.amazon.de/favicon.ico
// @grant        GM.xmlHttpRequest
// @updateURL    https://raw.githubusercontent.com/vondraussen/tampermonkey-scripts/main/scripts/amazon_order_grabber.vondraussen.js
// @downloadURL  https://raw.githubusercontent.com/vondraussen/tampermonkey-scripts/main/scripts/amazon_order_grabber.vondraussen.js
// ==/UserScript==

(function () {
    'use strict';

    const API_ENDPOINT = 'https://shipping.datonga.com/amazon_orders';

    // Function to scrape order details
    function scrapeOrderDetails() {
        const ordersTable = document.getElementById('orders-table');
        if (!ordersTable) {
            console.error('Orders table not found');
            return;
        }

        const rows = ordersTable.querySelectorAll('tbody tr');
        const orderDetails = [];

        rows.forEach(row => {
            const orderTimestampElement = row.querySelector('td:nth-child(2) .cell-body');
            const buyerNameElement = row.querySelector('[data-test-id="buyer-name-with-link"]');
            const orderIdElement = row.querySelector('.cell-body-title a');
            const orderLineItemsElement = row.querySelector('.myo-list-orders-product-name-cell');
            const orderStatusElement = row.querySelector('.main-status');
            const secondaryOrderStatusElement = row.querySelector('.secondary-status');

            if (orderTimestampElement && orderIdElement && orderLineItemsElement && orderStatusElement) {
                const orderDate = orderTimestampElement.querySelector('div:nth-child(2)').textContent.trim();
                const orderTime = orderTimestampElement.querySelector('div:nth-child(3)').textContent.trim();
                const orderTimestamp = `${orderDate} ${orderTime}`;
                const unixTimestamp = convertToUnixTimestamp(orderTimestamp);
                
                const orderId = orderIdElement.textContent.trim();
                const orderLink = orderIdElement.href;
                const buyerName = buyerNameElement ? buyerNameElement.textContent.trim() : 'Unknown';
                let orderStatus = orderStatusElement.textContent.trim();
                let secondaryOrderStatus = null;
                if (orderStatusElement.className.includes('shipped-status')) {
                    orderStatus = 3;
                    if (secondaryOrderStatusElement) {
                        secondaryOrderStatus = secondaryOrderStatusElement.className;
                        if (secondaryOrderStatus.includes('refund-is-applied')) {
                            secondaryOrderStatus = 'Refund Applied';
                            orderStatus = 4;
                        }
                    }
                } else if (orderStatusElement.className.includes('pending-status')) {
                    orderStatus = 2;
                } else {
                    console.error('Unknown order status:', orderStatus);
                    orderStatus = -1;
                }

                const lineItems = [];
                const lineItemName = orderLineItemsElement.querySelector('div:nth-child(1)').textContent.trim();
                const lineItemSku = orderLineItemsElement.querySelector('div:nth-child(2)').textContent.trim().replace('SKU:', '').trim();
                const lineItemQty = parseInt(orderLineItemsElement.querySelector('div:nth-child(3)').textContent.trim().replace('Stückzahl:', '').trim());
                const lineItemTotal = parseFloat(orderLineItemsElement.querySelector('div:nth-child(4)').textContent.trim().replace('Zwischensumme des Artikels: €', '').trim());
                lineItems.push({ name: lineItemName, sku: lineItemSku, quantity: lineItemQty, price: lineItemTotal/lineItemQty });
                orderDetails.push({ timestamp: unixTimestamp, orderId, orderLink, buyerName, lineItems, total: lineItemTotal, status: orderStatus});
            }
        });

        console.log('Scraped Order Details:', orderDetails);
        sendOrderDetails(orderDetails);
        return orderDetails;
    }

    // Function to convert date and time string to Unix timestamp
    function convertToUnixTimestamp(dateTimeStr) {
        const [date, time, timezone] = dateTimeStr.split(' ');
        const [day, month, year] = date.split('.').map(Number);
        const [hours, minutes] = time.split(':').map(Number);

        // Create a Date object with the parsed values
        const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes));

        // Adjust for the timezone if necessary (MET is UTC+1)
        if (timezone === 'MET') {
            dateObj.setUTCHours(dateObj.getUTCHours() - 1);
        }

        // Return the Unix timestamp
        return Math.floor(dateObj.getTime() / 1000);
    }

    // Function to send order details to the API endpoint
    function sendOrderDetails(orderDetails) {
        GM.xmlHttpRequest({
            method: 'POST',
            url: API_ENDPOINT,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(orderDetails),
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    console.log('Success:', response.responseText);
                } else {
                    console.error('Network response was not ok', response.statusText);
                }
            },
            onerror: function(error) {
                console.error('Fetch Error:', error);
            }
        });
    }

    // Wait for the DOM to be fully loaded
    window.addEventListener('load', () => {
        // Use setTimeout to ensure all dynamic content is loaded
        setTimeout(() => {
            scrapeOrderDetails();
        }, 2000); // Adjust the timeout duration as needed
    });
    console.log('Amazon Order Grabber script loaded');
})();
