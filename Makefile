install:
	npm install

.PHONY: test install

test:
	./node_modules/.bin/mocha
