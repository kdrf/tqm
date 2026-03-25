// --- Global Utilities ---
window.showToast = function (message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'));
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// --- Custom Select (Shadcn Style) Initialization ---
window.initShadcnSelects = function () {
    const selects = document.querySelectorAll('select:not(.native-only)');
    selects.forEach(select => {
        // Skip hidden or already customized selects
        if (select.dataset.customized || select.style.display === 'none') return;

        select.dataset.customized = 'true';
        select.style.display = 'none'; // Hide native select

        const wrapper = document.createElement('div');
        wrapper.className = 'shadcn-select-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.width = select.style.width || '100%';

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('div');
        trigger.className = 'shadcn-select-trigger';

        let selectedText = select.options.length > 0 && select.selectedIndex >= 0 ? select.options[select.selectedIndex].text : 'Seçin';

        trigger.innerHTML = `
            <span class="shadcn-select-value" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;">${selectedText}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; flex-shrink:0; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
        `;

        const popover = document.createElement('div');
        popover.className = 'shadcn-select-popover';

        const updateOptions = () => {
            popover.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                if (opt.style.display === 'none' || opt.disabled) return;
                const item = document.createElement('div');
                item.className = 'shadcn-select-item' + (select.selectedIndex === idx ? ' selected' : '');
                item.innerHTML = `
                     <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${opt.text}</span>
                     ${select.selectedIndex === idx ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                 `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    select.selectedIndex = idx;
                    trigger.querySelector('.shadcn-select-value').textContent = opt.text;
                    popover.classList.remove('open');
                    trigger.classList.remove('open');
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    updateOptions(); // Refresh selected state
                };
                popover.appendChild(item);
            });
        };

        updateOptions();

        trigger.onclick = (e) => {
            e.stopPropagation();
            // Close other open popovers
            document.querySelectorAll('.shadcn-select-popover.open').forEach(p => {
                if (p !== popover) {
                    p.classList.remove('open');
                    p.previousElementSibling.classList.remove('open');
                }
            });
            const isOpen = popover.classList.contains('open');
            if (isOpen) {
                popover.classList.remove('open');
                trigger.classList.remove('open');
            } else {
                updateOptions(); // Sync options before opening
                popover.classList.add('open');
                trigger.classList.add('open');
            }
        };

        // Listen to programmatic changes on real select to keep trigger updated
        select.addEventListener('change', () => {
            if (select.selectedIndex >= 0) {
                trigger.querySelector('.shadcn-select-value').textContent = select.options[select.selectedIndex].text;
                updateOptions();
            }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(popover);
    });
};

document.addEventListener('click', () => {
    document.querySelectorAll('.shadcn-select-popover.open').forEach(p => {
        p.classList.remove('open');
        if (p.previousElementSibling) p.previousElementSibling.classList.remove('open');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initShadcnSelects, 200);
});
