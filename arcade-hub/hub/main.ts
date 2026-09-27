// Точка входа хаба. На этапе А0 — пустая страница и тестовая точка.
import '../shared/ui/fonts';
import './styles.css';
import { getLang, t } from '../shared/i18n';

document.documentElement.lang = getLang();
document.title = t('hub.title');

const root = document.getElementById('hub');
if (!root) throw new Error('#hub not found');

// Pixi грузится отдельным чанком: оболочка хаба остаётся лёгкой (бюджет BUNDLE_HUB_KB).
const { mountTestDot } = await import('./dev/test-dot');
await mountTestDot(root);
