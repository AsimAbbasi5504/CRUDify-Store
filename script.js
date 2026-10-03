const mockProductsDatabase = [
    { id: 1, name: "Iron", price: 899, category: "Electronics", subcategory: "Appliances", stock: 5, image: "https://electrogallery.com.pk/wp-content/uploads/2025/07/HD-30-1.webp" },
    { id: 2, name: "Wireless Noise Cancelling Headphones", price: 299, category: "Electronics", subcategory: "Audio", stock: 3, image: "https://m.media-amazon.com/images/I/51GEDaBzrwL._AC_UF894,1000_QL80_.jpg" },
    { id: 3, name: "Premium Cotton Slim-Fit Hoodie", price: 59, category: "Clothing", subcategory: "Men", stock: 8, image: "https://wearochre.com/cdn/shop/files/black_simple_dress_design_black_dress_design_simple_black_dress_design.jpg?v=1767347922" },
    { id: 4, name: "Classic Leather Sports Sneakers", price: 85, category: "Clothing", subcategory: "Footwear", stock: 0, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgXO5APiMrkaYhqgKpGmmUYstIh5_9e8mQPeI5C0Ig0w&s" },
    { id: 5, name: "Mastering Asynchronous JavaScript (Book)", price: 45, category: "Books", subcategory: "Programming", stock: 12, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_lZljNkJ4oXmsv1Cocpr2Q-SvUBTPRQ2KcNcQynaOTGpjcy-vOLat9Fk&s=10" }
];

const validCouponsDatabase = {
    "SAVE10": { type: "percentage", value: 10 },
    "FLAT20": { type: "fixed", value: 20 },
    "FREESHIP": { type: "fixed", value: 0, freeShipping: true }
};

let activeCachedProducts = [];
let currentCartState = JSON.parse(localStorage.getItem('async_cart_session')) || [];
let activeDiscountModel = { code: "", type: "none", value: 0 };
let isCheckoutInProgress = false;
let selectedProducts = new Set();
let isBulkDeleteMode = false;

const CUSTOM_PRODUCTS_STORAGE_KEY = 'async_custom_products';
const CATEGORIES_STORAGE_KEY = 'app_categories';
const SUBCATEGORIES_STORAGE_KEY = 'app_subcategories';
const WISHLIST_STORAGE_KEY = 'app_wishlist';
const ORDERS_STORAGE_KEY = 'app_orders';
const THEME_STORAGE_KEY = 'app_theme';
const defaultCategories = ['Electronics', 'Clothing', 'Books'];
const defaultSubcategories = ['Appliances', 'Audio', 'Men', 'Footwear', 'Programming', 'Fiction', 'Non-Fiction'];

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }
    }, duration);
}

function loadCategories() {
    try {
        const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const all = [...new Set([...defaultCategories, ...parsed])];
            return all;
        }
        return [...defaultCategories];
    } catch {
        return [...defaultCategories];
    }
}

function saveCategories(categories) {
    const unique = [...new Set(categories)];
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(unique));
}

function updateCategoriesFromProducts() {
    const productCategories = activeCachedProducts
        .map(p => p.category)
        .filter(cat => cat && cat.trim() !== '')
        .map(cat => cat.trim());

    const allCategories = [...new Set([...defaultCategories, ...productCategories])];
    saveCategories(allCategories);
    updateCategoryDatalist();
    updateCategoryFilter();
    updateCategoryCounts();
}

function updateCategoryDatalist() {
    const datalist = document.getElementById('category-list');
    if (!datalist) return;
    const categories = loadCategories();
    datalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
}

function updateCategoryFilter() {
    const filterSelect = document.getElementById('category-filter');
    if (!filterSelect) return;
    const currentValue = filterSelect.value;
    const categories = loadCategories();
    filterSelect.innerHTML = `<option value="All">All Categories</option>`;
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        const count = activeCachedProducts.filter(p => p.category === cat).length;
        opt.textContent = `${cat} (${count})`;
        filterSelect.appendChild(opt);
    });
    if ([...filterSelect.options].some(o => o.value === currentValue)) {
        filterSelect.value = currentValue;
    } else {
        filterSelect.value = 'All';
    }
}

function updateCategoryCounts() {
    updateCategoryFilter();
}

function loadSubcategories() {
    try {
        const stored = localStorage.getItem(SUBCATEGORIES_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const all = [...new Set([...defaultSubcategories, ...parsed])];
            return all;
        }
        return [...defaultSubcategories];
    } catch {
        return [...defaultSubcategories];
    }
}

function saveSubcategories(subcategories) {
    const unique = [...new Set(subcategories)];
    localStorage.setItem(SUBCATEGORIES_STORAGE_KEY, JSON.stringify(unique));
}

function updateSubcategoriesFromProducts() {
    const productSubcategories = activeCachedProducts
        .map(p => p.subcategory)
        .filter(sub => sub && sub.trim() !== '')
        .map(sub => sub.trim());

    const allSubcategories = [...new Set([...defaultSubcategories, ...productSubcategories])];
    saveSubcategories(allSubcategories);
    updateSubcategoryDatalist();
}

function updateSubcategoryDatalist() {
    const datalist = document.getElementById('subcategory-list');
    if (!datalist) return;
    const subcategories = loadSubcategories();
    datalist.innerHTML = subcategories.map(sub => `<option value="${sub}">`).join('');
}

function loadWishlist() {
    try {
        return JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveWishlist(wishlist) {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
}

function toggleWishlist(productId) {
    let wishlist = loadWishlist();
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist ❤️', 'info');
    } else {
        wishlist.push(productId);
        showToast('Added to wishlist ❤️', 'success');
    }
    saveWishlist(wishlist);
    renderCatalogDisplay(executeFilteredCatalogComputation());
    renderWishlist();
}

function isInWishlist(productId) {
    const wishlist = loadWishlist();
    return wishlist.includes(productId);
}

function renderWishlist() {
    const container = document.getElementById('wishlist-items-container');
    const wishlist = loadWishlist();

    if (wishlist.length === 0) {
        container.innerHTML = `<p class="empty-wishlist-message">Your wishlist is empty.</p>`;
        return;
    }

    container.innerHTML = '';
    wishlist.forEach(id => {
        const product = activeCachedProducts.find(p => p.id === id);
        if (!product) return;

        const item = document.createElement('div');
        item.className = 'wishlist-item';
        item.innerHTML = `
            <div class="wishlist-item-info">
                <div class="wishlist-item-name">${product.name}</div>
                <div class="wishlist-item-price">$${product.price}</div>
            </div>
            <div class="wishlist-actions">
                <button class="move-to-cart-btn" onclick="moveWishlistToCart(${product.id})">🛒</button>
                <button class="remove-wishlist-btn" onclick="removeFromWishlist(${product.id})">✕</button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.moveWishlistToCart = function (productId) {
    const product = activeCachedProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = currentCartState.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity = Math.min(existingItem.quantity + 1, product.stock);
    } else {
        currentCartState.push({ ...product, quantity: 1 });
    }

    let wishlist = loadWishlist();
    wishlist = wishlist.filter(id => id !== productId);
    saveWishlist(wishlist);

    updateCartUserInterface();
    renderWishlist();
    renderCatalogDisplay(executeFilteredCatalogComputation());
    showToast('Moved to cart! 🛒', 'success');
};

window.removeFromWishlist = function (productId) {
    let wishlist = loadWishlist();
    wishlist = wishlist.filter(id => id !== productId);
    saveWishlist(wishlist);
    renderWishlist();
    renderCatalogDisplay(executeFilteredCatalogComputation());
    showToast('Removed from wishlist', 'info');
};

function loadOrders() {
    try {
        return JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveOrders(orders) {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function addOrder(order) {
    const orders = loadOrders();
    orders.unshift({
        id: 'ORD-' + Date.now(),
        date: new Date().toISOString(),
        items: order.items,
        total: order.total,
        discount: order.discount
    });
    saveOrders(orders);
}

function renderOrderHistory() {
    const container = document.getElementById('order-history-content');
    const orders = loadOrders();

    if (orders.length === 0) {
        container.innerHTML = `<p class="empty-orders-message">No orders yet. Start shopping!</p>`;
        return;
    }

    container.innerHTML = '';
    orders.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-item';
        const itemsList = order.items.map(item =>
            `${item.name} × ${item.quantity} — $${(item.price * item.quantity).toFixed(2)}`
        ).join('<br>');

        div.innerHTML = `
            <div class="order-header">
                <span class="order-id">${order.id}</span>
                <span class="order-date">${new Date(order.date).toLocaleDateString()} ${new Date(order.date).toLocaleTimeString()}</span>
            </div>
            <div class="order-items">${itemsList}</div>
            <div class="order-total">Total: $${order.total.toFixed(2)} ${order.discount > 0 ? `(Saved $${order.discount.toFixed(2)})` : ''}</div>
        `;
        container.appendChild(div);
    });
}

function toggleBulkDeleteMode() {
    isBulkDeleteMode = !isBulkDeleteMode;
    const btn = document.getElementById('bulk-delete-btn');
    if (isBulkDeleteMode) {
        btn.style.display = 'inline-block';
        showToast('Select products to delete', 'info');
    } else {
        btn.style.display = 'none';
        selectedProducts.clear();
        renderCatalogDisplay(executeFilteredCatalogComputation());
    }
}

function toggleProductSelection(productId) {
    if (!isBulkDeleteMode) return;
    if (selectedProducts.has(productId)) {
        selectedProducts.delete(productId);
    } else {
        selectedProducts.add(productId);
    }
    renderCatalogDisplay(executeFilteredCatalogComputation());
}

function deleteSelectedProducts() {
    if (selectedProducts.size === 0) {
        showToast('No products selected', 'warning');
        return;
    }

    if (!confirm(`Delete ${selectedProducts.size} selected products?`)) return;

    selectedProducts.forEach(id => {
        const product = activeCachedProducts.find(p => p.id === id);
        if (product && product.isCustom) {
            activeCachedProducts = activeCachedProducts.filter(p => p.id !== id);
            currentCartState = currentCartState.filter(item => item.id !== id);
            let wishlist = loadWishlist();
            wishlist = wishlist.filter(wid => wid !== id);
            saveWishlist(wishlist);
        }
    });

    selectedProducts.clear();
    persistCustomProducts();
    updateCategoriesFromProducts();
    updateSubcategoriesFromProducts();
    renderCatalogDisplay(executeFilteredCatalogComputation());
    updateCartUserInterface();
    renderWishlist();

    document.getElementById('bulk-delete-btn').style.display = 'none';
    isBulkDeleteMode = false;
    showToast('Selected products deleted!', 'success');
}

function exportProducts() {
    const data = {
        products: activeCachedProducts,
        categories: loadCategories(),
        subcategories: loadSubcategories(),
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Products exported successfully!', 'success');
}

function importProducts(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.products && Array.isArray(data.products)) {
                const existingIds = new Set(activeCachedProducts.map(p => p.id));
                let newProducts = data.products.filter(p => !existingIds.has(p.id));

                let maxId = Math.max(...activeCachedProducts.map(p => p.id), 0);
                newProducts = newProducts.map(p => {
                    maxId++;
                    return { ...p, id: maxId, isCustom: true };
                });

                activeCachedProducts = [...activeCachedProducts, ...newProducts];

                if (data.categories) {
                    const allCats = [...new Set([...loadCategories(), ...data.categories])];
                    saveCategories(allCats);
                }

                if (data.subcategories) {
                    const allSubs = [...new Set([...loadSubcategories(), ...data.subcategories])];
                    saveSubcategories(allSubs);
                }

                persistCustomProducts();
                updateCategoriesFromProducts();
                updateSubcategoriesFromProducts();
                renderCatalogDisplay(executeFilteredCatalogComputation());
                showToast(`Imported ${newProducts.length} products!`, 'success');
            } else {
                showToast('Invalid file format!', 'error');
            }
        } catch (err) {
            showToast('Error reading file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

function handleImageUpload(file, callback) {
    if (!file) { callback(null); return; }
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid image (JPEG, PNG, GIF, WEBP, SVG, BMP)', 'error');
        callback(null);
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be less than 5MB', 'error');
        callback(null);
        return;
    }
    const reader = new FileReader();
    reader.onload = e => callback(e.target.result);
    reader.onerror = () => {
        showToast('Failed to read image', 'error');
        callback(null);
    };
    reader.readAsDataURL(file);
}

function setupImageUpload(containerId, previewId, fileInputId, urlInputId, urlContainerId, optionsId,
    fileOptionId, urlOptionId, cancelId, applyId, onImageSet) {
    const container = document.getElementById(containerId);
    const preview = document.getElementById(previewId);
    const fileInput = document.getElementById(fileInputId);
    const urlInput = document.getElementById(urlInputId);
    const urlContainer = document.getElementById(urlContainerId);
    const options = document.getElementById(optionsId);
    const fileOption = document.getElementById(fileOptionId);
    const urlOption = document.getElementById(urlOptionId);
    const cancelBtn = document.getElementById(cancelId);
    const applyBtn = document.getElementById(applyId);

    let currentImage = null;

    container.addEventListener('click', (e) => {
        if (urlContainer.contains(e.target)) return;
        if (options.classList.contains('show')) {
            options.classList.remove('show');
        } else {
            options.classList.add('show');
        }
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            options.classList.remove('show');
        }
    });

    fileOption.addEventListener('click', (e) => {
        e.stopPropagation();
        options.classList.remove('show');
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            handleImageUpload(file, (base64) => {
                if (base64) {
                    currentImage = base64;
                    preview.src = base64;
                    preview.classList.add('show');
                    container.querySelector('.upload-text').textContent = 'Image uploaded ✓';
                    container.querySelector('.upload-subtext').textContent = 'Click to change';
                    if (onImageSet) onImageSet(base64);
                }
            });
        }
    });

    urlOption.addEventListener('click', (e) => {
        e.stopPropagation();
        options.classList.remove('show');
        urlContainer.classList.add('show');
        urlInput.value = '';
        urlInput.focus();
    });

    applyBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            try {
                new URL(url);
                currentImage = url;
                preview.src = url;
                preview.classList.add('show');
                container.querySelector('.upload-text').textContent = 'Image from URL ✓';
                container.querySelector('.upload-subtext').textContent = 'Click to change';
                urlContainer.classList.remove('show');
                if (onImageSet) onImageSet(url);
            } catch (e) {
                showToast('Please enter a valid URL', 'error');
            }
        } else {
            showToast('Please enter an image URL', 'error');
        }
    });

    cancelBtn.addEventListener('click', () => {
        urlContainer.classList.remove('show');
        urlInput.value = '';
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyBtn.click();
    });

    return {
        setImage: (imageSrc) => {
            if (imageSrc) {
                currentImage = imageSrc;
                preview.src = imageSrc;
                preview.classList.add('show');
                container.querySelector('.upload-text').textContent = 'Image set ✓';
                container.querySelector('.upload-subtext').textContent = 'Click to change';
            } else {
                preview.classList.remove('show');
                container.querySelector('.upload-text').textContent = 'Click to add image';
                container.querySelector('.upload-subtext').textContent = 'Upload from device or URL';
            }
        },
        getImage: () => currentImage,
        reset: () => {
            currentImage = null;
            preview.classList.remove('show');
            fileInput.value = '';
            urlInput.value = '';
            urlContainer.classList.remove('show');
            container.querySelector('.upload-text').textContent = 'Click to add image';
            container.querySelector('.upload-subtext').textContent = 'Upload from device or URL';
        }
    };
}

function fetchRemoteCatalogData() {
    return new Promise(resolve => setTimeout(() => resolve([...mockProductsDatabase]), 800));
}

function validateCouponOnServer(couponString) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const match = validCouponsDatabase[couponString.toUpperCase().trim()];
            match ? resolve(match) : reject(new Error("The voucher code entered is invalid or has expired!"));
        }, 600);
    });
}

function processSecureFinancialTransaction() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            Math.random() > 0.2 ?
                resolve({ transactionId: "TXN-" + Math.floor(Math.random() * 900000 + 100000) }) :
                reject(new Error("Payment processor handshake timeout. Terminal link disconnected!"));
        }, 1500);
    });
}

function loadCustomProductsFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY)) || [];
    } catch (e) {
        console.warn("Custom product storage corrupted, resetting.", e);
        return [];
    }
}

function persistCustomProducts() {
    const customOnly = activeCachedProducts.filter(p => p.isCustom === true);
    localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, JSON.stringify(customOnly));
}

function generateNextProductId() {
    const allIds = activeCachedProducts.map(p => p.id);
    return allIds.length ? Math.max(...allIds) + 1 : 1;
}

function addNewProductToCatalog({ name, price, category, subcategory, stock, imageFile }) {
    const cleanName = (name || "").trim();
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);
    const cleanCategory = (category || "").trim();
    const cleanSubcategory = (subcategory || "").trim();

    if (!cleanName) { showToast("Please enter a product name.", 'error'); return false; }
    if (isNaN(parsedPrice) || parsedPrice <= 0) { showToast("Please enter a valid price greater than 0.", 'error'); return false; }
    if (isNaN(parsedStock) || parsedStock < 0) { showToast("Please enter a valid stock quantity (0 or more).", 'error'); return false; }
    if (!cleanCategory) { showToast("Please choose or enter a category.", 'error'); return false; }

    let finalImage = "https://placehold.co/260x180?text=No+Image";
    if (imageFile) {
        finalImage = imageFile;
    }

    const newProduct = {
        id: generateNextProductId(),
        name: cleanName,
        price: parsedPrice,
        category: cleanCategory,
        subcategory: cleanSubcategory || '',
        stock: parsedStock,
        image: finalImage,
        isCustom: true,
        isBase64Image: (imageFile && imageFile.startsWith('data:image'))
    };

    activeCachedProducts.push(newProduct);
    persistCustomProducts();
    updateCategoriesFromProducts();
    updateSubcategoriesFromProducts();
    renderCatalogDisplay(executeFilteredCatalogComputation());
    showToast(`Product "${cleanName}" added successfully! ✅`, 'success');
    return true;
}

window.openEditProductModal = function (productId) {
    const product = activeCachedProducts.find(p => p.id === productId);
    if (!product) { showToast("Product not found!", 'error'); return; }
    if (!product.isCustom) { showToast("You can only edit custom products that you added!", 'error'); return; }

    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-price').value = product.price;
    document.getElementById('edit-product-category').value = product.category;
    document.getElementById('edit-product-subcategory').value = product.subcategory || '';
    document.getElementById('edit-product-stock').value = product.stock;

    if (product.image) {
        editImageUpload.setImage(product.image);
    } else {
        editImageUpload.reset();
    }

    document.getElementById('edit-product-modal').classList.remove('hidden');
};

function saveProductEdit(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('edit-product-id').value);
    const name = document.getElementById('edit-product-name').value.trim();
    const price = parseFloat(document.getElementById('edit-product-price').value);
    const category = document.getElementById('edit-product-category').value.trim();
    const subcategory = document.getElementById('edit-product-subcategory').value.trim();
    const stock = parseInt(document.getElementById('edit-product-stock').value);
    const image = editImageUpload.getImage();

    if (!name || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0 || !category) {
        showToast("Please fill all required fields correctly.", 'error');
        return;
    }

    const idx = activeCachedProducts.findIndex(p => p.id === id);
    if (idx === -1 || !activeCachedProducts[idx].isCustom) {
        showToast("Product not found or not editable.", 'error');
        return;
    }

    const cartItem = currentCartState.find(item => item.id === id);
    if (cartItem && cartItem.quantity > stock) {
        if (!confirm(`This product is in your cart (${cartItem.quantity} units). New stock is ${stock}. Reduce cart quantity?`)) {
            return;
        }
        cartItem.quantity = Math.min(cartItem.quantity, stock);
        if (cartItem.quantity === 0) {
            currentCartState = currentCartState.filter(item => item.id !== id);
        }
    }

    let finalImage = activeCachedProducts[idx].image;
    if (image) {
        finalImage = image;
    }

    activeCachedProducts[idx] = {
        ...activeCachedProducts[idx],
        name,
        price,
        category,
        subcategory: subcategory || '',
        stock,
        image: finalImage,
        isBase64Image: (image && image.startsWith('data:image'))
    };

    persistCustomProducts();
    updateCategoriesFromProducts();
    updateSubcategoriesFromProducts();
    document.getElementById('edit-product-modal').classList.add('hidden');
    renderCatalogDisplay(executeFilteredCatalogComputation());
    updateCartUserInterface();
    renderWishlist();
    showToast("Product updated successfully! ✅", 'success');
}

window.deleteCustomProduct = function (productId) {
    const product = activeCachedProducts.find(p => p.id === productId);
    if (!product || !product.isCustom) {
        showToast("You can only delete custom products!", 'error');
        return;
    }

    const cartItem = currentCartState.find(item => item.id === productId);
    if (cartItem) {
        if (!confirm(`"${product.name}" is in your cart (${cartItem.quantity} units). Deleting will also remove it from your cart. Continue?`)) {
            return;
        }
        currentCartState = currentCartState.filter(item => item.id !== productId);
    }

    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
        activeCachedProducts = activeCachedProducts.filter(p => p.id !== productId);
        persistCustomProducts();

        let wishlist = loadWishlist();
        wishlist = wishlist.filter(id => id !== productId);
        saveWishlist(wishlist);

        updateCategoriesFromProducts();
        updateSubcategoriesFromProducts();
        renderCatalogDisplay(executeFilteredCatalogComputation());
        updateCartUserInterface();
        renderWishlist();
        showToast(`Product "${product.name}" deleted! 🗑️`, 'success');
    }
};

function reconcileCartWithCatalog() {
    let cartWasAdjusted = false;
    currentCartState = currentCartState
        .map(cartItem => {
            const liveProduct = activeCachedProducts.find(p => p.id === cartItem.id);
            if (!liveProduct) {
                cartWasAdjusted = true;
                return null;
            }
            if (cartItem.quantity > liveProduct.stock) {
                cartWasAdjusted = true;
                return liveProduct.stock > 0 ?
                    { ...liveProduct, quantity: liveProduct.stock } :
                    null;
            }
            return { ...liveProduct, quantity: cartItem.quantity };
        })
        .filter(Boolean);

    if (cartWasAdjusted) {
        showToast('Cart adjusted: some items stock changed.', 'warning');
    }
}

function sortProducts(products, sortType) {
    const sorted = [...products];
    switch (sortType) {
        case 'price-asc':
            return sorted.sort((a, b) => a.price - b.price);
        case 'price-desc':
            return sorted.sort((a, b) => b.price - a.price);
        case 'name-asc':
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return sorted.sort((a, b) => b.name.localeCompare(a.name));
        case 'stock-asc':
            return sorted.sort((a, b) => a.stock - b.stock);
        case 'stock-desc':
            return sorted.sort((a, b) => b.stock - a.stock);
        default:
            return sorted;
    }
}

function renderCatalogDisplay(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = "";

    const sortType = document.getElementById('sort-filter').value;
    const sortedProducts = sortProducts(products, sortType);

    if (sortedProducts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">No products match your search.</p>`;
        return;
    }

    sortedProducts.forEach(product => {
        const cartEntry = currentCartState.find(item => item.id === product.id);
        const qtyAlreadyInCart = cartEntry ? cartEntry.quantity : 0;
        const remainingStock = product.stock - qtyAlreadyInCart;

        const isDisabled = remainingStock <= 0 || isCheckoutInProgress;
        const isCustom = product.isCustom === true;
        const inWishlist = isInWishlist(product.id);

        const card = document.createElement('div');
        card.className = "product-card";

        let actionsHtml = '';
        if (isCustom) {
            actionsHtml = `
                <div class="product-actions">
                    <button class="edit-btn" onclick="openEditProductModal(${product.id})">✏️ Edit</button>
                    <button class="delete-btn" onclick="deleteCustomProduct(${product.id})">🗑️ Delete</button>
                </div>
            `;
        }

        const categoryBadge = product.subcategory ?
            `<span class="category-badge">${product.category}</span><span class="subcategory-badge">${product.subcategory}</span>` :
            `<span class="category-badge">${product.category}</span>`;

        const checkboxHtml = isBulkDeleteMode && isCustom ?
            `<input type="checkbox" class="select-checkbox" onchange="toggleProductSelection(${product.id})" ${selectedProducts.has(product.id) ? 'checked' : ''}>` :
            '';

        card.innerHTML = `
            ${checkboxHtml}
            <button class="wishlist-btn ${inWishlist ? 'active' : ''}" onclick="toggleWishlist(${product.id})" title="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}">
                ${inWishlist ? '❤️' : '🤍'}
            </button>
            <img src="${product.image}" alt="${product.name}" onerror="this.onerror=null; this.src='https://placehold.co/260x180?text=No+Image';">
            <h3>${product.name}</h3>
            <p style="font-weight: bold; color: var(--primary);">$${product.price}</p>
            ${categoryBadge}
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Stock Left: ${remainingStock}</p>
            ${actionsHtml}
            <button
                class="add-to-cart-btn"
                onclick="addItemToCartContainer(${product.id})"
                ${isDisabled ? 'disabled' : ''}>
                ${remainingStock <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
        `;
        grid.appendChild(card);
    });
}

function updateCartUserInterface() {
    const container = document.getElementById('cart-items-container');
    const totalCounterBadge = document.getElementById('cart-count');
    container.innerHTML = "";
    let runningGrossSubtotal = 0;
    let absoluteItemsTotalCount = 0;

    if (currentCartState.length === 0) {
        container.innerHTML = `<p class="empty-cart-message">Your cart is empty.</p>`;
        document.getElementById('checkout-btn').disabled = true;
    } else {
        document.getElementById('checkout-btn').disabled = false;
        currentCartState.forEach(item => {
            runningGrossSubtotal += (item.price * item.quantity);
            absoluteItemsTotalCount += item.quantity;
            const row = document.createElement('div');
            row.className = "cart-item";
            row.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <div class="item-subtext">$${item.price} × ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <div class="quantity-controls">
                    <button onclick="adjustItemQuantity(${item.id}, -1)" ${isCheckoutInProgress ? 'disabled' : ''}>-</button>
                    <span style="font-size: 0.75rem; font-weight:700;">${item.quantity}</span>
                    <button onclick="adjustItemQuantity(${item.id}, 1)" ${isCheckoutInProgress ? 'disabled' : ''}>+</button>
                    <button onclick="removeItemFromCart(${item.id})" title="Remove item" style="margin-left:0.3rem; color: var(--danger, #dc2626); font-size:0.7rem; background:none;" ${isCheckoutInProgress ? 'disabled' : ''}>Remove</button>
                </div>
            `;
            container.appendChild(row);
        });
    }
    let discountAmount = 0;
    let shippingAmount = 0;
    const FREE_SHIPPING_THRESHOLD = 50;

    if (activeDiscountModel.type === "percentage") {
        discountAmount = runningGrossSubtotal * (activeDiscountModel.value / 100);
    } else if (activeDiscountModel.type === "fixed") {
        discountAmount = Math.min(activeDiscountModel.value, runningGrossSubtotal);
    }

    const subtotalAfterDiscount = runningGrossSubtotal - discountAmount;
    if (subtotalAfterDiscount > 0 && subtotalAfterDiscount < FREE_SHIPPING_THRESHOLD) {
        shippingAmount = 5.99;
    }

    const grandTotal = Math.max(0, subtotalAfterDiscount + shippingAmount);

    totalCounterBadge.textContent = absoluteItemsTotalCount;
    document.getElementById('summary-subtotal').textContent = `$${runningGrossSubtotal.toFixed(2)}`;
    document.getElementById('summary-discount').textContent = `-$${discountAmount.toFixed(2)}`;

    const shippingLine = document.getElementById('shipping-line');
    const shippingSpan = document.getElementById('summary-shipping');
    if (runningGrossSubtotal === 0) {
        shippingLine.style.display = 'none';
    } else if (subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD) {
        shippingSpan.textContent = 'FREE 🎉';
        shippingLine.querySelector('.label').textContent = 'Shipping:';
    } else {
        shippingLine.style.display = 'flex';
        shippingSpan.textContent = `$${shippingAmount.toFixed(2)}`;
        shippingLine.querySelector('.label').textContent = 'Shipping:';
    }

    document.getElementById('summary-total').textContent = `$${grandTotal.toFixed(2)}`;

    localStorage.setItem('async_cart_session', JSON.stringify(currentCartState));
}

window.addItemToCartContainer = function (productId) {
    if (isCheckoutInProgress) return;
    const product = activeCachedProducts.find(p => p.id === productId);
    if (!product) return;

    const existingItem = currentCartState.find(item => item.id === productId);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty < product.stock) {
        if (existingItem) {
            existingItem.quantity++;
        } else {
            currentCartState.push({ ...product, quantity: 1 });
        }
        let wishlist = loadWishlist();
        wishlist = wishlist.filter(id => id !== productId);
        saveWishlist(wishlist);

        updateCartUserInterface();
        renderCatalogDisplay(executeFilteredCatalogComputation());
        renderWishlist();
        showToast(`Added "${product.name}" to cart! 🛒`, 'success');
    } else {
        showToast("Cannot add more units. Stock limit reached.", 'warning');
    }
};

window.adjustItemQuantity = function (productId, delta) {
    if (isCheckoutInProgress) return;
    const index = currentCartState.findIndex(item => item.id === productId);
    if (index === -1) return;

    const cartItem = currentCartState[index];
    const product = activeCachedProducts.find(p => p.id === productId);

    if (delta === 1) {
        if (product && cartItem.quantity >= product.stock) {
            showToast("Cannot add more. Stock limit reached!", 'warning');
            return;
        }
        cartItem.quantity++;
    } else if (delta === -1) {
        if (cartItem.quantity <= 1) {
            showToast("Minimum quantity is 1. Use Remove button to delete.", 'info');
            return;
        }
        cartItem.quantity--;
    }

    updateCartUserInterface();
    renderCatalogDisplay(executeFilteredCatalogComputation());
};

window.removeItemFromCart = function (productId) {
    if (isCheckoutInProgress) return;
    const product = currentCartState.find(item => item.id === productId);
    currentCartState = currentCartState.filter(item => item.id !== productId);
    updateCartUserInterface();
    renderCatalogDisplay(executeFilteredCatalogComputation());
    if (product) showToast(`Removed "${product.name}" from cart`, 'info');
};

function executeFilteredCatalogComputation() {
    const query = document.getElementById('search-bar').value.toLowerCase().trim();
    const category = document.getElementById('category-filter').value;

    return activeCachedProducts.filter(product => {
        const matchesQuery = product.name.toLowerCase().includes(query);
        const matchesCategory = category === "All" || product.category === category;
        return matchesQuery && matchesCategory;
    });
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function toggleUIElementsGlobalLoadingState(isProcessing, statusMessage = "Processing...") {
    const shieldContainer = document.getElementById('global-status-container');
    const statusTextLabelNode = document.getElementById('global-status-message');
    const checkoutBtn = document.getElementById('checkout-btn');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');

    if (isProcessing) {
        shieldContainer.classList.remove('hidden');
        statusTextLabelNode.textContent = statusMessage;
        checkoutBtn.disabled = true;
        applyCouponBtn.disabled = true;
    } else {
        shieldContainer.classList.add('hidden');
        applyCouponBtn.disabled = false;
        updateCartUserInterface();
    }
}

let searchTimeout;

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        renderCatalogDisplay(executeFilteredCatalogComputation());
    }, 300);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 E-Commerce App Initialized");

    loadTheme();
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    document.getElementById('search-bar').addEventListener('input', debounceSearch);

    const searchInput = document.getElementById('search-bar');
    const searchClear = document.getElementById('search-clear');
    searchInput.addEventListener('input', () => {
        searchClear.classList.toggle('hidden', searchInput.value === '');
    });
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.classList.add('hidden');
        renderCatalogDisplay(executeFilteredCatalogComputation());
    });

    document.getElementById('category-filter').addEventListener('change', () => {
        renderCatalogDisplay(executeFilteredCatalogComputation());
    });

    document.getElementById('sort-filter').addEventListener('change', () => {
        renderCatalogDisplay(executeFilteredCatalogComputation());
    });

    try {
        const serverProducts = await fetchRemoteCatalogData();
        const savedCustomProducts = loadCustomProductsFromStorage();
        activeCachedProducts = [...serverProducts, ...savedCustomProducts];
        console.log("Data successfully received:", activeCachedProducts.length, "products");

        document.getElementById('products-loading').classList.add('hidden');
        reconcileCartWithCatalog();

        updateCategoriesFromProducts();
        updateSubcategoriesFromProducts();

        renderCatalogDisplay(activeCachedProducts);
        updateCartUserInterface();
        renderWishlist();

        showToast('Store loaded successfully! 🎉', 'success');
    } catch (error) {
        console.error("Server connection failed:", error.message);
        document.getElementById('products-loading').textContent = "Server crashed. Please reload page!";
        showToast('Failed to load products!', 'error');
        return;
    }

    let addImageValue = null;
    const addImageUpload = setupImageUpload(
        'add-image-upload-container',
        'add-image-preview',
        'add-image-file-input',
        'add-image-url-input',
        'add-url-input-container',
        'add-upload-options',
        'add-upload-file-option',
        'add-upload-url-option',
        'add-url-cancel',
        'add-url-apply',
        (val) => { addImageValue = val; }
    );

    let editImageValue = null;
    const editImageUpload = setupImageUpload(
        'edit-image-upload-container',
        'edit-image-preview',
        'edit-image-file-input',
        'edit-image-url-input',
        'edit-url-input-container',
        'edit-upload-options',
        'edit-upload-file-option',
        'edit-upload-url-option',
        'edit-url-cancel',
        'edit-url-apply',
        (val) => { editImageValue = val; }
    );

    window.editImageUpload = editImageUpload;

    document.getElementById('add-product-btn').addEventListener('click', () => {
        const name = document.getElementById('new-product-name');
        const price = document.getElementById('new-product-price');
        const category = document.getElementById('new-product-category');
        const subcategory = document.getElementById('new-product-subcategory');
        const stock = document.getElementById('new-product-stock');
        const image = addImageUpload.getImage();

        const wasAdded = addNewProductToCatalog({
            name: name.value,
            price: price.value,
            category: category.value,
            subcategory: subcategory.value,
            stock: stock.value,
            imageFile: image
        });

        if (wasAdded) {
            name.value = '';
            price.value = '';
            category.value = '';
            subcategory.value = '';
            stock.value = '';
            addImageUpload.reset();
            addImageValue = null;
        }
    });

    document.getElementById('apply-coupon-btn').addEventListener('click', async () => {
        const inputDomRef = document.getElementById('coupon-input');
        const feedbackMessageZone = document.getElementById('coupon-feedback');
        const applyBtn = document.getElementById('apply-coupon-btn');
        const processedRawString = inputDomRef.value.trim();

        if (!processedRawString) return;
        applyBtn.disabled = true;
        inputDomRef.disabled = true;
        feedbackMessageZone.style.color = "";
        feedbackMessageZone.textContent = "Checking coupon...";
        feedbackMessageZone.className = "feedback-message-node text-success-accent";

        try {
            const result = await validateCouponOnServer(processedRawString);
            activeDiscountModel = {
                code: processedRawString.toUpperCase(),
                type: result.type,
                value: result.value,
                freeShipping: result.freeShipping || false
            };
            const discountLabel = result.type === "percentage" ? `${result.value}% off` : `$${result.value} off`;
            const shippingLabel = result.freeShipping ? ' + Free Shipping 🚚' : '';
            feedbackMessageZone.textContent = `✅ Coupon applied! ${discountLabel}${shippingLabel}`;
            feedbackMessageZone.className = "feedback-message-node text-success-accent";
            showToast(`Coupon applied! ${discountLabel}${shippingLabel}`, 'success');
            updateCartUserInterface();
        } catch (err) {
            feedbackMessageZone.textContent = err.message;
            feedbackMessageZone.className = "feedback-message-node";
            feedbackMessageZone.style.color = "var(--danger)";
            showToast(err.message, 'error');
        } finally {
            applyBtn.disabled = false;
            inputDomRef.disabled = false;
        }
    });

    document.getElementById('checkout-btn').addEventListener('click', async () => {
        if (currentCartState.length === 0) return;
        for (let item of currentCartState) {
            const masterProduct = activeCachedProducts.find(p => p.id === item.id);
            if (masterProduct) {
                if (item.quantity > masterProduct.stock) {
                    showToast(`"${item.name}" is going out of stock! Available: ${masterProduct.stock}`, 'error');
                    return;
                }
            }
            if (item.quantity < 1) {
                item.quantity = 1;
                updateCartUserInterface();
                return;
            }
        }

        isCheckoutInProgress = true;
        toggleUIElementsGlobalLoadingState(true, "Processing your order...");
        renderCatalogDisplay(executeFilteredCatalogComputation());
        updateCartUserInterface();

        try {
            const transaction = await processSecureFinancialTransaction();
            const itemsListHtml = currentCartState.map(item => `
                <li>${item.name} &times; ${item.quantity} — $${(item.price * item.quantity).toFixed(2)}</li>
            `).join("");

            const total = parseFloat(document.getElementById('summary-total').textContent.replace('$', ''));
            const subtotal = parseFloat(document.getElementById('summary-subtotal').textContent.replace('$', ''));
            const discount = parseFloat(document.getElementById('summary-discount').textContent.replace('-$$', '').replace('$', ''));

            const receiptOutputZoneDom = document.getElementById('modal-summary-content');
            receiptOutputZoneDom.innerHTML = `
                <p><strong>Order Number:</strong> ${transaction.transactionId}</p>
                <ul style="text-align:left; margin: 0.5rem 0 1rem 1rem; padding:0;">${itemsListHtml}</ul>
                <p><strong>Total Paid:</strong> $${total.toFixed(2)}</p>
                <p>✅ Status: Your order has been placed successfully.</p>
            `;

            addOrder({
                items: currentCartState.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                total: total,
                discount: discount || 0
            });

            currentCartState = [];
            activeDiscountModel = { code: "", type: "none", value: 0 };
            document.getElementById('coupon-input').value = "";
            document.getElementById('coupon-feedback').textContent = "";
            localStorage.removeItem('async_cart_session');

            document.getElementById('success-modal').classList.remove('hidden');
            showToast('Order placed successfully! 🎉', 'success');
        } catch (paymentError) {
            showToast("Payment Failed: " + paymentError.message, 'error');
        } finally {
            isCheckoutInProgress = false;
            toggleUIElementsGlobalLoadingState(false);
            renderCatalogDisplay(executeFilteredCatalogComputation());
            updateCartUserInterface();
        }
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('success-modal').classList.add('hidden');
    });

    document.querySelector('.wishlist-link')?.addEventListener('click', () => {
        renderOrderHistory();
        document.getElementById('order-history-modal').classList.remove('hidden');
    });

    document.getElementById('close-orders-modal').addEventListener('click', () => {
        document.getElementById('order-history-modal').classList.add('hidden');
    });

    document.getElementById('order-history-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('order-history-modal')) {
            document.getElementById('order-history-modal').classList.add('hidden');
        }
    });

    document.querySelector('.wishlist-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('wishlist-sidebar').classList.toggle('show');
    });

    document.getElementById('close-wishlist').addEventListener('click', () => {
        document.getElementById('wishlist-sidebar').classList.remove('show');
    });

    document.getElementById('export-btn').addEventListener('click', exportProducts);

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importProducts(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('bulk-delete-btn').addEventListener('click', deleteSelectedProducts);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            toggleBulkDeleteMode();
        }
    });

    document.getElementById('edit-product-form').addEventListener('submit', saveProductEdit);

    document.getElementById('close-edit-modal').addEventListener('click', () => {
        document.getElementById('edit-product-modal').classList.add('hidden');
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        document.getElementById('edit-product-modal').classList.add('hidden');
    });

    document.getElementById('edit-product-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('edit-product-modal')) {
            document.getElementById('edit-product-modal').classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'w') {
            e.preventDefault();
            document.getElementById('wishlist-sidebar').classList.toggle('show');
        }
        if (e.key === 'Escape') {
            document.getElementById('edit-product-modal').classList.add('hidden');
            document.getElementById('success-modal').classList.add('hidden');
            document.getElementById('order-history-modal').classList.add('hidden');
            document.getElementById('wishlist-sidebar').classList.remove('show');
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            toggleBulkDeleteMode();
        }
    });

    showToast('💡 Ctrl+W: Wishlist | Ctrl+Shift+D: Bulk Delete | Esc: Close', 'info', 4000);
});