# Third-party notices

This repository is distributed under the MIT license in `LICENSE`. It contains material from the
following MIT-licensed projects.

## rsc-harness

Copyright (c) 2026 Eric Risco

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Source: https://github.com/ericrisco/rsc-harness (v3.1.3, commit
`beb2af6233a368ca78d26d88257141fb1d599e45`).

## REA

Copyright (c) 2026 morluto

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Source: https://github.com/morluto/rea (`rea-agents` 6.7.0, commit
`0bc2b42001f684beffcf47b70e507443b1a5d320`).

Included material: the `reverse-engineer-anything` skill text and its six reference documents,
copied into `skills/rea/` and modified for this harness (name, pinned package version, harness
section, attribution metadata). The REA CLI, MCP server and bridge code are not copied; they are
installed from the published `rea-agents` package at the version pinned above.

## Provider engines

REA can use optional, separately licensed engines (Hopper, Ghidra, IDA Pro, JEB, Kuna, JADX,
Wireshark/tshark, binwalk, unblob, Frida and others). None is bundled here. Each remains under its
own license and is installed by the operator only when an investigation needs it.
