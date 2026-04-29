const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');

export function showModal(title, message, onConfirm, onCancel) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modal.style.display = 'flex';

  function cleanUp() {
    modal.style.display = 'none';
    modalConfirm.removeEventListener('click', confirmHandler);
    if (modalCancel) modalCancel.removeEventListener('click', cancelHandler);
  }

  function confirmHandler() {
    cleanUp();
    if (onConfirm) onConfirm();
  }

  function cancelHandler() {
    cleanUp();
    if (onCancel) onCancel();
  }

  modalConfirm.addEventListener('click', confirmHandler);
  if (modalCancel) modalCancel.addEventListener('click', cancelHandler);
}
