(() => {
    const utils = {
        formatDateToLocal(isoDateString) {
            if (!isoDateString) return '-';
            try {
                const date = new Date(isoDateString);
                if (isNaN(date.getTime())) return 'Fecha inválida';
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${day}/${month} ${hours}:${minutes}`;
            } catch (error) {
                console.error('Error formateando fecha:', error, isoDateString);
                return 'Error';
            }
        },
        convertAllDates() {
            try {
                const dateCells = document.querySelectorAll('.date-cell[data-iso-date]');
                dateCells.forEach(cell => {
                    const isoDate = cell.getAttribute('data-iso-date');
                    cell.textContent = utils.formatDateToLocal(isoDate);
                });
            } catch (error) {
                console.error('Error convirtiendo fechas:', error);
            }
        }
    };

    window.App = window.App || {};
    window.App.utils = utils;

    document.addEventListener('DOMContentLoaded', () => {
        utils.convertAllDates();
    });
})();
