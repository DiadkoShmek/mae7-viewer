# STROIKA · architectural review viewer

An interactive 3D view of a building, its façade layers and construction details.

**[Open the 3D viewer](https://diadkoshmek.github.io/mae7-viewer/)** · [Review drawings](https://diadkoshmek.github.io/mae7-viewer/budmaster/)

[![Building model showing façade panels, roof and balconies](assets/mae7-preview.webp)](https://diadkoshmek.github.io/mae7-viewer/)

## Explore

- Rotate, pan and zoom the model using the on-screen controls.
- Switch between the building, façade layers, roof and plinth views.
- Use the Estonian or Ukrainian interface; inspect the published drawings and model references.

The purpose is visual review and explanation. Small details are simplified, and model dimensions do not replace site measurements or an approved construction design.

Original project files and signed documents are kept by the project owner. The public viewer contains model material and review drawings.

## This repository

A public browser release built with JavaScript and Three.js. [Release identity](STATIC_RELEASE.json) records the source commit and model identity.

To serve a checkout locally, use Python 3:

```bash
python3 -m http.server 8874 --bind 127.0.0.1
```

Open **http://127.0.0.1:8874/** in a browser with WebGL support. Serve over HTTP rather than opening the HTML file directly.

## Українською

Інтерактивна модель для огляду будівлі, фасадних шарів і деталей. Візуалізація допомагає пояснювати проєктні рішення, але не є підтвердженням точності обмірів чи дозволом на виконання будівельних робіт.

[Відкрити 3D](https://diadkoshmek.github.io/mae7-viewer/) · [Матеріали для звірки](https://diadkoshmek.github.io/mae7-viewer/budmaster/) · [Інші проєкти](https://github.com/DiadkoShmek)
