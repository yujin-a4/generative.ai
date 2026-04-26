export function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (typeof document === 'undefined') return;

  const existingToast = document.getElementById('custom-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  
  // Base classes for animation and positioning
  toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl text-sm font-bold z-[9999] transition-all duration-300 transform translate-y-10 opacity-0 flex items-center gap-2 border`;

  if (type === 'success') {
    toast.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500');
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  } else {
    toast.classList.add('bg-red-600', 'text-white', 'border-red-500');
    toast.innerHTML = `<span>⚠️</span><span>${message}</span>`;
  }

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
