import './style.css';
import { mountBook } from './book';

const el = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const choices = {
  volume: {
    title: 'Dikdörtgenler prizmasının hacmini hesaplar.',
    context: 'Geometri · Hacim ilişkisi',
    reason: 'Soru, üç ayrıt uzunluğunu kullanarak hacim hesaplama becerisini ölçüyor. Bu nedenle hacimle ilgili bir öğrenme hedefiyle ilişkilendirilebilir.',
  },
  units: {
    title: 'Hacim ölçme birimlerini tanır.',
    context: 'Ölçme · Hacim birimleri',
    reason: 'Soru, sonucu cm³ cinsinden ifade etmeyi gerektiriyor. Hacim birimlerini tanıma, bu soruyu çözmek için kullanılan destekleyici bir beceridir.',
  },
  model: {
    title: 'Geometrik cisimlerin özelliklerini ilişkilendirir.',
    context: 'Geometri · Cisimlerin özellikleri',
    reason: 'Soru, prizmanın üç boyutunu hacmiyle ilişkilendirmeyi gerektiriyor. Bu hedef, soruya daha geniş bir geometrik bakış sağlar.',
  },
};
type Target = keyof typeof choices;
let selected: Target = 'volume';
const options = el<HTMLFieldSetElement>('#target-options');
const approve = el<HTMLButtonElement>('#approve-target');
const change = el<HTMLButtonElement>('#change-target');
const feedback = el('#demo-feedback');

function setOptions(open: boolean) {
  options.hidden = !open;
  change.setAttribute('aria-expanded', String(open));
}
function renderTarget() {
  const target = choices[selected];
  el('#target-title').textContent = target.title;
  el('#target-context').textContent = target.context;
  el('#target-reason').textContent = target.reason;
  approve.disabled = false;
  approve.innerHTML = 'Hedefi onayla <span aria-hidden="true">✓</span>';
}
approve.addEventListener('click', () => {
  feedback.textContent = 'Hedefi onayladınız. Bu örnekte seçim sizin deneyiminizle tamamlandı.';
  approve.innerHTML = 'Onaylandı <span aria-hidden="true">✓</span>';
  approve.disabled = true;
  setOptions(false);
});
change.addEventListener('click', () => setOptions(options.hidden));
options.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (!(input.value in choices)) return;
  selected = input.value as Target;
  renderTarget();
  feedback.textContent = 'Alternatif hedef seçildi. İnceleyip onaylayabilirsiniz.';
});
el('#reset-demo').addEventListener('click', () => {
  selected = 'volume';
  el<HTMLInputElement>('input[value="volume"]').checked = true;
  renderTarget();
  setOptions(false);
  feedback.textContent = 'Örnek başlangıç durumuna döndü.';
});

const menuButton = el<HTMLButtonElement>('.menu-toggle');
const menu = el<HTMLElement>('#mobile-nav');
function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Menüyü aç');
}
menuButton.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
});
menu.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
matchMedia('(min-width: 601px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});

const dialog = el<HTMLDialogElement>('#pages-dialog');
el('#read-pages').addEventListener('click', () => dialog.showModal());
el('#close-pages').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

mountBook(el('#book-canvas'), el<HTMLButtonElement>('#reset-view'));
