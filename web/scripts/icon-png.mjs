/**
 * Render app/icon.svg to the 512 px PNG the submission form takes.
 *
 *   node scripts/icon-png.mjs
 *
 * The mark sits inside the central circle, so a circular crop keeps it whole.
 */
import sharp from 'sharp';

await sharp('app/icon.svg', { density: 300 }).resize(512, 512).png().toFile('../submission/redline-icon-512.png');
console.log('wrote submission/redline-icon-512.png');
