install:
	npm install

.PHONY: test

test:
	./node_modules/.bin/mocha
