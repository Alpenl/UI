# Local media fixtures

Synthetic 8-second VP8/WebM clips generated with FFmpeg's `testsrc2`; no external or user media.

Reproduce with `ffmpeg -f lavfi -i testsrc2=size=320x180:rate=12 -t 8 -c:v libvpx -b:v 70k -an landscape.webm`.
Portrait uses `180x320`, square uses `240x240`. Browser tests serve the bytes through a mocked same-origin Range endpoint and verify intrinsic dimensions, controls, touch and playback.
