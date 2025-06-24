// ==UserScript==
// @name         Etsy Email Grabber
// @namespace    http://tampermonkey.net/
// @version      2025-06-24
// @description  Grab Etsy order emails and send them to an API endpoint
// @author       vondraussen
// @match        https://www.etsy.com/your/orders/sold*
// @match        https://www.etsy.com/your/orders/sold/new*
// @icon         https://www.etsy.com/images/favicon.ico
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/vondraussen/tampermonkey-scripts/main/scripts/etsy_email_grabber.user.js
// @downloadURL  https://raw.githubusercontent.com/vondraussen/tampermonkey-scripts/main/scripts/etsy_email_grabber.user.js
// ==/UserScript==

(function () {
    'use strict';

    const API_ENDPOINT = 'https://shipping.datonga.com/update_order_email';

    // Function to scrape order IDs and email addresses
    function scrapeOrderInfo() {
        const orders = document.querySelectorAll('.order-group-list .panel-body-row');
        const orderInfo = [];

        orders.forEach(order => {
            const orderIdElement = order.querySelector('input[type="checkbox"]');
            const emailElement = order.querySelector('a[href^="mailto:"]');

            if (orderIdElement && emailElement) {
                const orderId = orderIdElement.value;
                const email = emailElement.href.replace('mailto:', '');
                orderInfo.push({ orderId, email });
            }
        });

        console.log('Scraped Order Info:', orderInfo);
        sendOrderInfo(orderInfo);
        return orderInfo;
    }

    // Function to send order info to the API endpoint
    function sendOrderInfo(orderInfo) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_ENDPOINT,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(orderInfo),
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

    // Function to observe changes in the DOM
    function observeDOMChanges() {
        const targetNode = document.querySelector('.order-group-list');
        if (!targetNode) {
            console.error('Target node not found');
            return;
        }

        const config = { childList: true, subtree: true };

        const callback = function (mutationsList, observer) {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    console.log('DOM mutation detected');
                    scrapeOrderInfo();
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    }

    // Wait for the DOM to be fully loaded
    window.addEventListener('load', () => {
        // Use setTimeout to ensure all dynamic content is loaded
        setTimeout(() => {
            observeDOMChanges();
            scrapeOrderInfo(); // Initial scrape after starting observation
        }, 1500); // Adjust the timeout duration as needed
    });
})();
