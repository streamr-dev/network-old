module.exports = class NumberPair {
    constructor(a, b) {
        this.a = a
        this.b = b
    }

    greaterThanOrEqual(otherPair) {
        return this.greaterThan(otherPair) || this.equalTo(otherPair)
    }

    greaterThan(otherPair) {
        return this._compareTo(otherPair) === 1
    }

    equalTo(otherPair) {
        return this._compareTo(otherPair) === 0
    }

    _compareTo(otherPair) {
        if (this.a > otherPair.a) {
            return 1
        }
        if (this.a < otherPair.a) {
            return -1
        }
        if (this.b > otherPair.b) {
            return 1
        }
        if (this.b < otherPair.b) {
            return -1
        }
        return 0
    }
}
