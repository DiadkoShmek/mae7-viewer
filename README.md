# STROIKA · architectural review viewer

An interactive 3D view of a building and its façade details, based on referenced public project material.

**[Open the viewer →](https://diadkoshmek.github.io/mae7-viewer/)**

![Overview of the project-based building model](assets/mae7-preview.webp)

## Explore

- Rotate, pan and zoom the model using the on-screen controls.
- Switch between the building, façade layers, roof and plinth views.
- Use the Estonian or Ukrainian interface; inspect the project references linked in the viewer.

The purpose is visual review and explanation. Small details are simplified, and model dimensions do not replace site measurements or an approved construction design.

## This repository

A public browser release built with JavaScript and Three.js. [Release identity](STATIC_RELEASE.json) records the source commit and model identity. This overview does not change the model, calculations or application code.

To serve a checkout locally, use Python 3:

```bash
python3 -m http.server 8874 --bind 127.0.0.1
```

Open **http://127.0.0.1:8874/** in a browser with WebGL support. Serve over HTTP rather than opening the HTML file directly.

## Українською

Інтерактивна модель для огляду будівлі, фасадних шарів і деталей. Візуалізація допомагає пояснювати проєктні рішення, але не є підтвердженням точності обмірів чи дозволом на виконання будівельних робіт.

[Profile and contact](https://github.com/DiadkoShmek)
