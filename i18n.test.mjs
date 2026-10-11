import test from 'node:test';
import assert from 'node:assert/strict';
import {translate} from './i18n.js';
import {catalog} from './i18n-catalog.js';

test('dynamic drawing labels translate fully while preserving source dimensions and IDs',()=>{
 assert.equal(translate('Лист S001, P222, 1192 на 1250 мм'),'Leht S001, P222, 1192 × 1250 mm');
 assert.equal(translate('Розкладка плит фасаду ПдСх · входи, варіант V64. Помаранчеві деталі мають конфлікти крайових відстаней.'),'Fassaadiplaatide paigutus: Kagu · sissepääsud · variant V64. Oranžidel detailidel on servakauguste konfliktid.');
 assert.equal(translate('На моделі: 2 / 4 · усі значення у списку'),'Mudelil: 2 / 4 · kõik väärtused on loendis');
});

test('long phrases win and short words cannot corrupt unknown Ukrainian words',()=>{
 const source='Розміри з моделі до оглядового розсування';
 assert.equal(translate('RFI-11 · '+source),'RFI-11 · '+catalog[source]);
 assert.equal(translate('ПримітивнаНевідомаПлита'),'ПримітивнаНевідомаПлита');
 assert.equal(translate('Mäe tn 7 · P070 · 1192 × 1250 mm'),'Mäe tn 7 · P070 · 1192 × 1250 mm');
});

test('switching to Ukrainian preserves original authored source and mapped labels',()=>{
 const source='Розміри з моделі до оглядового розсування';
 assert.equal(translate(source,'uk'),source);
 assert.equal(translate(catalog[source],'uk'),source);
 assert.equal(translate('RFI-11 · '+source,'uk'),'RFI-11 · '+source);
});
