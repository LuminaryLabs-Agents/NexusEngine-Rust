.PHONY: test apk quest-apk adb-quest-check macos-app host-ffi downloads-page package-nexus package-goldrush package-default-rust-project validate-default-rust-project package-physics-cube-demo validate-physics-cube-demo package-project-compiler-proof package-downloads

test:
	cargo test --workspace
	node local-kits/tests/native-host-domain-kits.test.mjs
	node local-kits/tests/primitive-cube-object-kit.test.mjs
	node local-kits/tests/physics-cube-object-kit.test.mjs
	node local-kits/tests/quest-xr-frame-loop-kit.test.mjs
	node local-kits/tests/project-compiler-domain-kit.test.mjs

apk:
	bash scripts/build-apk.sh

quest-apk:
	bash scripts/build-apk.sh

adb-quest-check:
	bash scripts/adb-quest-demo-check.sh

macos-app:
	bash scripts/build-macos-app.sh

host-ffi:
	bash scripts/package-host-ffi.sh

downloads-page:
	python3 scripts/write-download-page.py

package-nexus:
	bash scripts/package-nexus-project.sh "$(PROJECT)"

package-goldrush:
	PROJECT=/Users/crimsonwheeler/Documents/GitHub/NexusEngine-GoldRush bash scripts/package-nexus-project.sh

package-default-rust-project:
	STRICT=1 TARGETS=web-static,electron,macos-app PROJECT=projects/default-rust-project bash scripts/package-nexus-project.sh

validate-default-rust-project: package-default-rust-project
	node scripts/validate-electron-package.mjs dist/packager/work/default-rust-project/electron-host
	bash scripts/validate-macos-web-app.sh dist/packager/artifacts/macos-app/DefaultRustProject.app

package-physics-cube-demo:
	STRICT=1 TARGETS=web-static,electron,macos-app PROJECT=projects/physics-cube-demo bash scripts/package-nexus-project.sh

validate-physics-cube-demo: package-physics-cube-demo
	NEXUS_VALIDATE_MIN_FRAME=12 node scripts/validate-electron-package.mjs dist/packager/work/physics-cube-demo/electron-host
	EXPECTED_KIT_HASHES=kits/primitive-cube-object-kit.mjs,kits/physics-cube-object-kit.mjs bash scripts/validate-macos-web-app.sh dist/packager/artifacts/macos-app/PhysicsCubeDemo.app

package-project-compiler-proof:
	STRICT=1 TARGETS=web-static,native-rust-headless PROJECT=projects/project-compiler-proof bash scripts/package-nexus-project.sh

package-downloads:
	bash scripts/package-downloads.sh
