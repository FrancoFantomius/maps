// maps Toast Module

export function showToast(text, type = "info") {
    const el = document.getElementById('toast');
    const txt = document.getElementById('toast-text');
    const icon = document.getElementById('toast-icon-container');
    
    if (!el || !txt || !icon) return;
    
    txt.innerText = text;
    icon.className = type === "error" ? "p-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-500" : "p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400";
    
    el.classList.remove('translate-y-12', 'opacity-0');
    
    // Clear any existing timeouts if possible, or just standard 3s dismiss
    setTimeout(() => {
        el.classList.add('translate-y-12', 'opacity-0');
    }, 3000);
}
